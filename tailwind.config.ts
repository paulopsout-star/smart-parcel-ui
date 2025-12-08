import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        payment: {
          card: "hsl(var(--payment-card))",
          selected: "hsl(var(--payment-selected))",
          hover: "hsl(var(--payment-hover))",
          border: "hsl(var(--payment-border))",
          shadow: "hsl(var(--payment-shadow))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          light: "hsl(var(--brand-light))",
          dark: "hsl(var(--brand-dark))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          secondary: "hsl(var(--ink-secondary))",
          muted: "hsl(var(--ink-muted))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          alt: "hsl(var(--surface-alt))",
          light: "hsl(var(--surface-light))",
        },
        feedback: {
          error: "hsl(var(--feedback-error))",
          "error-bg": "hsl(var(--feedback-error-bg))",
          warning: "hsl(var(--feedback-warning))",
          "warning-bg": "hsl(var(--feedback-warning-bg))",
          success: "hsl(var(--feedback-success))",
          "success-bg": "hsl(var(--feedback-success-bg))",
          info: "hsl(var(--feedback-info))",
          "info-bg": "hsl(var(--feedback-info-bg))",
        },
        autopay: {
          primary: "hsl(var(--autopay-primary))",
          "primary-soft": "hsl(var(--autopay-primary-soft))",
          "primary-strong": "hsl(var(--autopay-primary-strong))",
          yellow: "hsl(var(--autopay-yellow))",
          red: "hsl(var(--autopay-red))",
          bg: "hsl(var(--autopay-bg))",
          surface: "hsl(var(--autopay-surface))",
          "surface-dark": "hsl(var(--autopay-surface-dark))",
          text: "hsl(var(--autopay-text))",
          "text-secondary": "hsl(var(--autopay-text-secondary))",
          border: "hsl(var(--autopay-border))",
        },
      },
      boxShadow: {
        "autopay-card": "0 18px 40px rgba(0,0,0,0.12)",
        "autopay-card-soft": "0 10px 24px rgba(0,0,0,0.08)",
        "autopay-floating": "0 24px 60px rgba(0,0,0,0.18)",
      },
      backgroundImage: {
        "gradient-autopay-safety": "linear-gradient(135deg, hsl(152 74% 62%) 0%, hsl(152 100% 42%) 50%, hsl(170 100% 35%) 100%)",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-brand": "var(--gradient-brand)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-surface": "var(--gradient-surface)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float-mockup": "float-mockup 6s ease-in-out infinite",
        "slide-up-stagger": "slide-up-stagger 0.5s ease-out forwards",
      },
      keyframes: {
        "float-mockup": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "slide-up-stagger": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
