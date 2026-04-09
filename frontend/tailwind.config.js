/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        accent: "hsl(var(--accent))"
      },
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"]
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "soft-pop": {
          from: { opacity: "0", transform: "scale(0.98) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out",
        "soft-pop": "soft-pop 0.45s ease-out"
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
};
