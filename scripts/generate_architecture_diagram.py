"""
Generira arhitekturni diagram NutrixPOS z označenimi tveganji.
Uporablja matplotlib znotraj ene PNG datoteke.
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.patches import Circle, RegularPolygon
import matplotlib.font_manager as fm

# Registriraj font za slovenščino (vsebuje šumnike)
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

OUT = "/home/z/my-project/download/arhitektura_nutrixpos.png"

# Barvna paleta
COLOR_PRIMARY = "#1F3A5F"      # temno modra (backend)
COLOR_ACCENT = "#C00000"       # rdeča (tveganja)
COLOR_WARNING = "#E67E22"      # oranžna
COLOR_OK = "#27AE60"           # zelena
COLOR_INFO = "#2980B9"         # modra (frontend)
COLOR_BG = "#F4F6F8"           # svetlo siva
COLOR_DB = "#8E44AD"           # vijolična (baza)
COLOR_EXT = "#16A085"          # teal (zunanji)

fig, ax = plt.subplots(figsize=(16, 11), constrained_layout=True)
ax.set_xlim(0, 100)
ax.set_ylim(0, 70)
ax.set_aspect('equal')
ax.axis('off')
fig.patch.set_facecolor('white')

# Naslov
ax.text(50, 67.5, 'Arhitektura NutrixPOS — komponente in varnostna tveganja',
        fontsize=18, fontweight='bold', ha='center', color=COLOR_PRIMARY)
ax.text(50, 65, 'Modularni monolit z Go backend-om in Vue 3 frontend-om',
        fontsize=11, style='italic', ha='center', color='#6C757D')


def add_box(x, y, w, h, title, subtitle="", color=COLOR_PRIMARY,
            text_color='white', fontsize=11):
    """Nariše zaobljen pravokotnik z naslovom."""
    box = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.3,rounding_size=0.8",
                          facecolor=color, edgecolor='white', linewidth=2)
    ax.add_patch(box)
    ax.text(x + w/2, y + h/2 + (0.6 if subtitle else 0), title,
            ha='center', va='center', fontsize=fontsize,
            color=text_color, fontweight='bold')
    if subtitle:
        ax.text(x + w/2, y + h/2 - 1.2, subtitle,
                ha='center', va='center', fontsize=8,
                color=text_color, style='italic')


def add_arrow(x1, y1, x2, y2, color='#555555', style='->', label='',
              label_offset=(0, 0.8), linestyle='-', linewidth=1.5):
    """Nariše puščico med dvema točkama."""
    arrow = FancyArrowPatch((x1, y1), (x2, y2),
                             arrowstyle=style,
                             color=color, linewidth=linewidth,
                             linestyle=linestyle,
                             mutation_scale=15)
    ax.add_patch(arrow)
    if label:
        mx, my = (x1 + x2) / 2 + label_offset[0], (y1 + y2) / 2 + label_offset[1]
        ax.text(mx, my, label, fontsize=8, ha='center', va='center',
                color=color, style='italic',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white',
                          edgecolor='none', alpha=0.85))


def add_risk_marker(x, y, severity='Kritično', text=''):
    """Označi tveganje z rdečim krogom in besedilom."""
    color_map = {
        'Kritično': COLOR_ACCENT,
        'Visoko': COLOR_WARNING,
        'Srednje': '#F1C40F',
        'Nizko': COLOR_OK,
    }
    color = color_map.get(severity, COLOR_ACCENT)
    # Majhen krogec
    ax.plot(x, y, 'o', markersize=12, color=color, markeredgecolor='white',
            markeredgewidth=2, zorder=10)
    ax.text(x, y, '!', ha='center', va='center', fontsize=9,
            color='white', fontweight='bold', zorder=11)
    if text:
        ax.text(x + 1.5, y, text, fontsize=7.5, va='center',
                color=color, fontweight='bold', style='italic')


# ============================================================================
# NARIŠI KOMPONENTE
# ============================================================================

# --- Uporabnik (zgoraj levo) ---
add_box(2, 55, 14, 7, "Uporabnik", "cashier / chef / admin",
        color='#34495E', fontsize=11)
ax.text(9, 53.5, "Browser (Vue 3 SPA)", fontsize=8, ha='center',
        style='italic', color='#555')

# --- Frontend (sredina zgoraj) ---
add_box(20, 53, 22, 9, "Frontend (Vue 3)", "Port 3000 / 80",
        color=COLOR_INFO, fontsize=11)
ax.text(31, 51.5, "Pinia • PrimeVue • Vue Router",
        fontsize=8, ha='center', color='#555')

# --- Reverse proxy / Load balancer (oznaka) ---
add_box(48, 55, 12, 6, "Reverse Proxy", "(priporočeno, manjka)",
        color='#95A5A6', fontsize=10)

# --- Backend Go (sredina) ---
add_box(30, 35, 30, 12, "Backend (Go + gorilla/mux)", "Port 8000 (0.0.0.0)",
        color=COLOR_PRIMARY, fontsize=12)

# --- Moduli znotraj backenda ---
add_box(31, 36, 12, 5, "core modul", "materials, orders, sales",
        color='#2C5282', fontsize=9)
add_box(45, 36, 14, 5, "hubsync modul", "sync s hub API",
        color='#2C5282', fontsize=9)
add_box(31, 42, 28, 3.5, "Auth (JWT + Zitadel)  •  CORS  •  Rate Limit (manjka)",
        color='#1A365D', fontsize=8.5)

# --- MongoDB (desno) ---
add_box(74, 35, 20, 12, "MongoDB 5.0", "Port 27017",
        color=COLOR_DB, fontsize=12)
ax.text(84, 33, "collections: users, materials, products, sales, ...",
        fontsize=7.5, ha='center', color='#555')

# --- Zunanji hub API (desno zgoraj) ---
add_box(74, 53, 20, 6, "Hub API (zunanji)", "sinhronizacija",
        color=COLOR_EXT, fontsize=10)

# --- Setup datoteka (spodaj levo) ---
add_box(2, 35, 20, 8, "config.yaml", "YAML konfiguracija",
        color='#7F8C8D', fontsize=10)
ax.text(12, 33.5, "jwt_secret, db, cors, ...", fontsize=7.5, ha='center',
        color='#555', style='italic')

# --- Frontend statične datoteke (levo) ---
add_box(2, 47, 14, 5, "mnt/frontend/", "statične datoteke",
        color='#7F8C8D', fontsize=9)

# --- Tiskalniki (spodaj) ---
add_box(20, 18, 18, 7, "Toplotni tiskalnik", "ESC/POS protokol",
        color='#D35400', fontsize=10)
add_box(42, 18, 18, 7, "PDF tisk", "chromedp + Handlebars",
        color='#D35400', fontsize=10)

# --- WebSocket (desno spodaj) ---
add_box(74, 18, 20, 7, "WebSocket (melody)", "realnočasovna obvestila",
        color='#16A085', fontsize=10)

# --- Odjemalske naprave (spodaj) ---
add_box(2, 18, 14, 7, "Kuhinja zaslon", "Kitchen.vue",
        color='#34495E', fontsize=10)
add_box(2, 5, 30, 7, "POS terminal (cashier)", "Home.vue",
        color='#34495E', fontsize=10)
add_box(36, 5, 25, 7, "Admin panel", "Admin.vue (vloge: admin)",
        color='#34495E', fontsize=10)
add_box(65, 5, 29, 7, "Zitadel OIDC (optional)", "namestitev zunaj",
        color='#9B59B6', fontsize=10)

# ============================================================================
# POVEZAVE (puščice)
# ============================================================================

# Uporabnik → Frontend
add_arrow(16, 58, 20, 58, color='#3498DB', label='HTTPS\n(priporočeno)')
add_risk_marker(18, 60, 'Visoko', 'Brez HTTPS')

# Frontend → Backend
add_arrow(42, 53, 45, 47, color='#3498DB', label='HTTP/REST\n/ core /api/*')
add_risk_marker(43.5, 51, 'Visoko', 'CORS *')

# Frontend → backend (WebSocket)
add_arrow(31, 53, 35, 47, color='#16A085', label='WebSocket\n/ws', linestyle='--')

# Backend → MongoDB
add_arrow(60, 41, 74, 41, color=COLOR_DB, label='mongo-driver')
add_risk_marker(67, 43, 'Kritično', 'Brez gesla')

# Backend → Hub API
add_arrow(60, 45, 74, 56, color=COLOR_EXT, label='PUT /v1/api/*\nbearer token',
          label_offset=(2, 0))

# Backend → config.yaml
add_arrow(30, 39, 22, 39, color='#7F8C8D', label='branje')
add_arrow(22, 37, 30, 37, color=COLOR_ACCENT, label='pisanje\n(setup endpoint)',
          linestyle='-.')
add_risk_marker(25, 35, 'Kritično', 'Setup brez auth')

# Backend → tiskalniki
add_arrow(35, 35, 29, 25, color='#D35400', label='ESC/POS')
add_arrow(50, 35, 51, 25, color='#D35400', label='chromedp')

# Backend → WebSocket
add_arrow(60, 37, 80, 25, color='#16A085', linestyle='--',
          label='melody')

# Frontend statične datoteke
add_arrow(9, 52, 9, 53, color='#7F8C8D')

# Kuhinja/POS/Admin → Frontend
add_arrow(9, 25, 9, 47, color='#3498DB', linestyle=':', linewidth=1)
add_arrow(15, 12, 25, 53, color='#3498DB', linestyle=':', linewidth=1)
add_arrow(48, 12, 35, 53, color='#3498DB', linestyle=':', linewidth=1)

# Zitadel (optional, črtkano)
add_arrow(78, 12, 60, 35, color='#9B59B6', linestyle='--',
          label='OIDC\n(optional)')

# ============================================================================
# LEGENDA
# ============================================================================

legend_x = 2
legend_y = 70 - 20  # spodaj levo, a znotraj

# premakni legendo na dno
legend_y = 0

ax.add_patch(Rectangle((legend_x, legend_y), 96, 4, facecolor='#F8F9FA',
                       edgecolor='#DEE2E6', linewidth=0.5))

# Legenda barv
legend_items = [
    (COLOR_INFO, 'Frontend'),
    (COLOR_PRIMARY, 'Backend'),
    (COLOR_DB, 'Podatkovna baza'),
    (COLOR_EXT, 'Zunanji sistem'),
    ('#D35400', 'Strojni tiskalnik'),
    ('#7F8C8D', 'Datotečni sistem'),
]
for i, (color, label) in enumerate(legend_items):
    x_pos = legend_x + 1 + i * 8
    ax.add_patch(Rectangle((x_pos, legend_y + 1.3), 1, 1.4,
                           facecolor=color, edgecolor='white'))
    ax.text(x_pos + 1.3, legend_y + 2, label, fontsize=8, va='center')

# Legenda tveganj
severity_legend = [
    (COLOR_ACCENT, 'Kritično'),
    (COLOR_WARNING, 'Visoko'),
    ('#F1C40F', 'Srednje'),
    (COLOR_OK, 'Nizko'),
]
for i, (color, label) in enumerate(severity_legend):
    x_pos = legend_x + 50 + i * 10
    ax.plot(x_pos, legend_y + 2, 'o', markersize=8, color=color,
            markeredgecolor='white', markeredgewidth=1)
    ax.text(x_pos, legend_y + 2, '!', ha='center', va='center',
            fontsize=6, color='white', fontweight='bold')
    ax.text(x_pos + 1.2, legend_y + 2, label, fontsize=8, va='center')

# Vrsta povezav
ax.text(legend_x + 95, legend_y + 2, '— HTTP   ⋯ WebSocket   ⋯ ID/OIDC',
        fontsize=7.5, va='center', ha='right', color='#555',
        style='italic')

# ============================================================================
# POVZETEK TVEGANJ (desno zgoraj)
# ============================================================================

summary_x = 65
summary_y = 60.5
ax.add_patch(FancyBboxPatch((summary_x, summary_y - 5.5), 33, 5.5,
                              boxstyle="round,pad=0.3,rounding_size=0.5",
                              facecolor='#FFF5F5', edgecolor=COLOR_ACCENT,
                              linewidth=1.5))
ax.text(summary_x + 1, summary_y - 0.8, 'POVPRAŠEVANJE TVEGANJ',
        fontsize=9, fontweight='bold', color=COLOR_ACCENT)
ax.text(summary_x + 1, summary_y - 2.2,
        '3 kritične • 5 visoke • 5 srednje • 3 nizke',
        fontsize=8, color='#333')
ax.text(summary_x + 1, summary_y - 3.5,
        'Skupna ocena zrelosti: 2.9/5',
        fontsize=8, color='#333')
ax.text(summary_x + 1, summary_y - 4.7,
        'Status: NE PRIMERNO za produkcijo',
        fontsize=8, color=COLOR_ACCENT, fontweight='bold')

# Podnaslov spodaj
ax.text(50, -2.5,
        'Diagram prikazuje tok podatkov od uporabnika preko Vue 3 frontend-a do Go backend-a in MongoDB.\n'
        'Rdeče oznake (!) označujejo varnostna tveganja, podrobneje opisana v dokumentu varnostni_pregled_nutrixpos.pdf.',
        fontsize=8.5, ha='center', va='center', color='#555', style='italic')

# Shrani
os.makedirs(os.path.dirname(OUT), exist_ok=True)
plt.savefig(OUT, dpi=180, bbox_inches='tight', facecolor='white',
            edgecolor='none')
plt.close()
print(f"OK: {OUT}")
