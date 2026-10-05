# Plataforma Turbo IA — Design System

Identidade visual extraída da logo oficial. Use este arquivo como referência para todas as páginas, landing pages e materiais da marca.

---

## 1. Logo

- **Símbolo:** letras "T" e "O" estilizadas formando um monograma — o "T" em barra reta e o "O" em anel/círculo, sugerindo velocidade e movimento (turbo).
- **Wordmark:** "PLATAFORMA TURBO IA" em caixa alta, fonte geométrica sans-serif de traço quadrado/técnico (estilo tipo "Orbitron" / "Eurostile" / "Bank Gothic" — visual tech, industrial, veloz).
- **Fundo padrão:** preto (`#000000`).
- **Uso mínimo recomendado:** símbolo + wordmark lado a lado, como no arquivo original. Em espaços pequenos (favicon, ícone de app), usar apenas o símbolo T+O.
- **Área de proteção:** manter um espaço livre ao redor da logo equivalente à altura do "T" do símbolo.

---

## 2. Paleta de cores

### Cores primárias (gradiente da marca)

| Nome | Hex | RGB | Uso |
|---|---|---|---|
| Turbo Red | `#FF392C` | 255, 57, 44 | Início do gradiente, CTAs, destaques quentes |
| Turbo Magenta | `#D9002D` | 217, 0, 45 | Transição do gradiente |
| Turbo Purple | `#8E3AAA` | 142, 58, 170 | Fim do gradiente, elementos secundários |
| Turbo Violet | `#8738B5` | 135, 56, 181 | Sombra/profundidade do gradiente |

**Gradiente oficial (diagonal, usado no símbolo):**
```css
background: linear-gradient(135deg, #FF392C 0%, #D9002D 45%, #8E3AAA 80%, #8738B5 100%);
```

### Cores neutras

| Nome | Hex | Uso |
|---|---|---|
| Preto Turbo | `#000000` | Fundo principal, base da marca |
| Branco | `#FFFFFF` | Texto sobre fundo escuro, wordmark |
| Cinza Claro | `#F5F5F5` | Fundos alternativos claros (seções) |
| Cinza Texto | `#B3B3B3` | Texto secundário sobre fundo escuro |
| Cinza Escuro | `#1A1A1A` | Cards e blocos sobre fundo preto |

---

## 3. Tipografia

- **Títulos / Headlines:** fonte geométrica, quadrada, tech — sugestões próximas ao estilo da logo: `Orbitron`, `Eurostile`, `Michroma`, ou `Rajdhani` (Google Fonts, gratuitas).
- **Corpo de texto:** fonte sans-serif limpa e legível para não competir com o título: `Inter`, `Poppins` ou `Montserrat`.

```css
/* Sugestão de import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&display=swap');

--font-heading: 'Rajdhani', sans-serif;
--font-body: 'Inter', sans-serif;
```

**Hierarquia sugerida:**
- H1: 40–56px, bold, caixa alta ou title case, cor branca ou gradiente
- H2: 28–36px, bold
- H3: 20–24px, semibold
- Corpo: 16–18px, regular, cinza claro (`#F5F5F5`) sobre fundo escuro
- Legendas/labels: 13–14px, uppercase, letter-spacing +1px

---

## 4. Aplicação do gradiente

Use o gradiente da marca com moderação, como elemento de destaque — não em blocos grandes de texto:

- Botões (CTA) principais
- Ícones e bordas de destaque
- Sublinhados/underlines de títulos
- Bordas de cards em hover
- Barra de progresso, badges "novo", "exclusivo"

```css
.btn-primary {
  background: linear-gradient(135deg, #FF392C, #D9002D, #8E3AAA);
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## 5. Estilo visual geral (mood)

- **Tom:** tech, veloz, urbano, alto contraste — preto predominante com explosões de cor no gradiente vermelho→roxo.
- **Formas:** geométricas, retas, quinas levemente arredondadas (não totalmente orgânicas).
- **Contraste:** sempre alto contraste (texto branco/claro sobre fundo preto ou cinza muito escuro).
- **Evitar:** pastéis, fundos brancos puros como base principal, fontes serifadas/clássicas, ilustrações fofas/orgânicas — foge do posicionamento "turbo/tech".

---

## 6. Tokens rápidos (CSS variables)

```css
:root {
  /* Cores */
  --color-bg: #000000;
  --color-bg-alt: #1A1A1A;
  --color-text: #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-red: #FF392C;
  --color-magenta: #D9002D;
  --color-purple: #8E3AAA;
  --color-violet: #8738B5;
  --gradient-primary: linear-gradient(135deg, #FF392C 0%, #D9002D 45%, #8E3AAA 80%, #8738B5 100%);

  /* Tipografia */
  --font-heading: 'Rajdhani', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Raio de borda */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
}
```
