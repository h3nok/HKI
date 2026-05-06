/**
 * useVoiceRecorder — MediaRecorder + transcription pipeline
 *
 * State machine: idle → requesting → recording → processing → idle
 *
 * Flow:
 *  1. User clicks mic → request microphone permission
 *  2. Start MediaRecorder, accumulate chunks, show elapsed time
 *  3. Auto-stop at VOICE_MAX_DURATION_MS
 *  4. User clicks stop → assemble Blob → call onTranscription callback
 *     (the parent decides whether to upload → transcribe via tRPC, or
 *      just insert the audio blob as an attachment)
 *  5. Reset to idle
 *
 * The hook does NOT own the network layer — it hands back the blob and
 * lets the consumer decide what to do with it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordingState } from './prompt-input.types';
import { VOICE_MAX_DURATION_MS, VOICE_MIME_TYPE, VOICE_FALLBACK_MIME } from './prompt-input.tokens';

interface UseVoiceRecorderOptions {
  /** Max recording length in ms (default: 120 000 = 2 min) */
  maxDuration?: number;
  /** Called with the recorded blob when recording ends */
  onRecordingComplete?: (blob: Blob, durationMs: number) => void;
  /** Called if an error occurs */
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function useVoiceRecorder({
  maxDuration = VOICE_MAX_DURATION_MS,
  onRecordingComplete,
  onError,
  disabled = false,
}: UseVoiceRecorderOptions = {}) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup ───────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setElapsedMs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // ── Negotiate MIME type ───────────────────────────────────────────
  const getMimeType = useCallback(() => {
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported(VOICE_MIME_TYPE)) return VOICE_MIME_TYPE;
      if (MediaRecorder.isTypeSupported(VOICE_FALLBACK_MIME)) return VOICE_FALLBACK_MIME;
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    }
    return ''; // let browser pick default
  }, []);

  // ── Start recording ───────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (disabled || recordingState !== 'idle') return;

    setRecordingState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (blob.size > 0) {
          setRecordingState('processing');
          onRecordingComplete?.(blob, duration);
        }

        // Reset after short delay so "processing" state is visible
        setTimeout(() => {
          setRecordingState('idle');
          setElapsedMs(0);
        }, 300);
      };

      recorder.onerror = () => {
        onError?.('Recording failed unexpectedly');
        cleanup();
        setRecordingState('error');
        setTimeout(() => setRecordingState('idle'), 2000);
      };

      // Start
      recorder.start(250); // collect chunks every 250 ms
      startTimeRef.current = Date.now();
      setRecordingState('recording');

      // Elapsed timer (update every 100 ms for smooth display)
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);

      // Auto-stop at max duration
      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, maxDuration);
    } catch (err) {
      cleanup();
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Could not access microphone';
      onError?.(message);
      setRecordingState('error');
      setTimeout(() => setRecordingState('idle'), 2000);
    }
  }, [disabled, recordingState, getMimeType, maxDuration, onRecordingComplete, onError, cleanup]);

  // ── Stop recording ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Cancel (discard without processing) ───────────────────────────
  const cancelRecording = useCallback(() => {
    cleanup();
    setRecordingState('idle');
  }, [cleanup]);

  // ── Toggle (start/stop) ───────────────────────────────────────────
  const toggleRecording = useCallback(() => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  }, [recordingState, startRecording, stopRecording]);

  // ── Formatted elapsed time ────────────────────────────────────────
  const formattedTime = formatDuration(elapsedMs);

  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

  return {
    recordingState,
    isRecording,
    isProcessing,
    elapsedMs,
    formattedTime,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
