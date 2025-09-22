# Paleta Autonegocie

Cores extraídas do site https://autonegocie.com/ para aplicação no Hub de Pagamentos.

## Cores Principais

### Brand (Verde Vibrante)
- **Primary**: `#00D678` - Verde principal da marca
- **Light**: `#33E194` - Verde claro para hover/focus
- **Dark**: `#00B865` - Verde escuro para pressed states

### Accent (Verde Secundário)
- **Primary**: `#00F586` - Verde accent mais brilhante
- **Light**: `#66F7A8` - Verde accent claro
- **Dark**: `#00CC73` - Verde accent escuro

### Neutros
- **Ink Primary**: `#FFFFFF` - Texto principal (branco)
- **Ink Secondary**: `#E6E6E6` - Texto secundário
- **Ink Muted**: `#B3B3B3` - Texto desabilitado

### Superfícies
- **Surface Primary**: `#1E3A5F` - Fundo principal (azul escuro)
- **Surface Alt**: `#0F1F3D` - Fundo alternativo (azul mais escuro)
- **Surface Light**: `#2A4A70` - Fundo claro para cards

## Conversão HSL (para Tailwind)

```css
/* Brand Colors */
--brand: 152 100% 42%;           /* #00D678 */
--brand-light: 152 77% 54%;      /* #33E194 */
--brand-dark: 152 100% 36%;      /* #00B865 */

/* Accent Colors */
--accent: 150 100% 48%;          /* #00F586 */
--accent-light: 150 89% 67%;     /* #66F7A8 */
--accent-dark: 150 100% 40%;     /* #00CC73 */

/* Ink (Text) Colors */
--ink: 0 0% 100%;                /* #FFFFFF */
--ink-secondary: 0 0% 90%;       /* #E6E6E6 */
--ink-muted: 0 0% 70%;           /* #B3B3B3 */

/* Surface Colors */
--surface: 209 52% 24%;          /* #1E3A5F */
--surface-alt: 209 61% 15%;      /* #0F1F3D */
--surface-light: 209 48% 31%;    /* #2A4A70 */
```

## Aplicação

- **Hero Background**: Gradiente de surface-alt para surface
- **CTAs**: brand com ink text
- **Cards**: surface-light com brand borders
- **Links**: brand com hover em brand-light
- **Text**: ink primary/secondary baseado na hierarquia