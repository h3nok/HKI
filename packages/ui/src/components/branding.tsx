/**
 * HKI Innovation Branding Components
 * Shared logo and icon components for the unified platform
 * 
 * Usage:
 *   import { Logo, HkiIcon } from "@hki/ui";
 * 
 * Assets are bundled from packages/ui/public/
 */

// Import SVG files as URLs (Vite handles this)
import logoSvg from '../../public/logo.svg';
import iconSvg from '../../public/icon.svg';

interface LogoProps {
  className?: string;
  height?: number;
}

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Full HKI Innovation logo (with text)
 */
export function Logo({ className = "", height = 60 }: LogoProps) {
  return (
    <img
      src={logoSvg}
      alt="HKI"
      className={className}
      style={{ height: `${height}px`, width: "auto" }}
    />
  );
}

/**
 * HKI Innovation Icon only (no text)
 */
export function HkiIcon({ size = 64, className = "" }: IconProps) {
  return (
    <img
      src={iconSvg}
      alt="HKI"
      className={className}
      style={{ width: `${size}px`, height: "auto" }}
    />
  );
}

// Aliases for backward compatibility
export const ChipIcon = HkiIcon;
export const Icon = HkiIcon;
export const HkiInnovationLogo = Logo;
export const HkiInnovationIcon = HkiIcon;

export const Branding = {
  Logo,
  Icon: HkiIcon,
  HkiIcon,
};
