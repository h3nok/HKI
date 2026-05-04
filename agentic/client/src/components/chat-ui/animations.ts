/**
 * Animation Variants for Framer Motion
 * Consistent animations across the Agentic platform
 */

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

export const fadeInScale = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
};

export const slideIn = {
  left: {
    hidden: { x: -100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
  right: {
    hidden: { x: 100, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
  up: {
    hidden: { y: 100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
  down: {
    hidden: { y: -100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
};

export const pulse = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 0.3,
    ease: "easeInOut",
  },
};

export const shimmer = {
  x: [-100, 100],
  transition: {
    duration: 1.5,
    ease: "easeInOut",
    repeat: Infinity,
    repeatDelay: 0.5,
  },
};

export const glow = {
  animate: {
    boxShadow: [
      "0 0 20px rgba(43, 69, 194, 0)",
      "0 0 20px rgba(43, 69, 194, 0.3)",
      "0 0 20px rgba(43, 69, 194, 0)",
    ],
    transition: {
      duration: 2,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

export const bounce = {
  y: [0, -10, 0],
  transition: {
    duration: 0.5,
    ease: "easeOut",
    repeat: Infinity,
    repeatDelay: 1.5,
  },
};

export const rotate = {
  rotate: 360,
  transition: {
    duration: 1,
    ease: "linear",
    repeat: Infinity,
  },
};

export const springConfig = {
  type: "spring",
  stiffness: 260,
  damping: 20,
};
