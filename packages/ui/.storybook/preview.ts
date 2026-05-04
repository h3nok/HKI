import type { Preview } from "@storybook/react-vite";

// Load design system tokens so components render correctly
import "../tokens/index.css";
import "../styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },
};

export default preview;
