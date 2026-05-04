import { NotFoundPage } from "@hki/ui";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return <NotFoundPage onGoHome={() => setLocation("/")} />;
}
