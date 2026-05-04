import { motion } from 'framer-motion';

const SHIMMER_DELAY = 0.05;

type ShimmeringTextProps = {
  text: string;
  enabled?: boolean;
};

export const ShimmeringText = ({
  text,
  enabled = true,
}: ShimmeringTextProps) => {
  const characters = text.split('');

  if (!enabled) {
    return <>{text}</>;
  }

  return (
    <div className="relative inline-flex">
      {characters.map((char, index) => (
        <motion.span
          key={index}
          animate={{
            opacity: [1, 0.3, 1],
          }}
          transition={{
            delay: index * 0.02,
            duration: text.length * 0.02,
            repeat: Infinity,
            repeatDelay: characters.length * 0.02 + SHIMMER_DELAY,
            ease: 'easeInOut',
          }}
          className="text-foreground"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  );
};
