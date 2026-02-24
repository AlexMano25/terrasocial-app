#!/usr/bin/env python3
"""
TERRASOCIAL — Prospectus Commercial mis à jour (Février 2026)
Nouveau modèle : Frais dossier 10 000 FCFA + versements mensuel/journalier
Slogan : 2 bières par jour pour votre terrain titré !
"""

import sys, os

OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else '/sessions/nice-quirky-tesla/mnt/Code_source'
OUT_FILE = os.path.join(OUT_DIR, 'Prospectus_TERRASOCIAL_Fev2026.pdf')

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, HRFlowable, PageBreak, KeepTogether)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Couleurs ────────────────────────────────────────────────────────────────
GREEN       = colors.HexColor('#2E7D32')
GREEN_DARK  = colors.HexColor('#1B5E20')
GREEN_LIGHT = colors.HexColor('#E8F5E9')
GREEN_MID   = colors.HexColor('#C8E6C9')
ORANGE      = colors.HexColor('#FF9800')
ORANGE_DARK = colors.HexColor('#E65100')
ORANGE_LIGHT= colors.HexColor('#FFF8E1')
ORANGE_MID  = colors.HexColor('#FFE082')
WHITE       = colors.white
BLACK       = colors.HexColor('#333333')
GRAY        = colors.HexColor('#666666')
GRAY_LIGHT  = colors.HexColor('#F5F5F5')
GRAY_MID    = colors.HexColor('#E0E0E0')

W, H = A4
MARGIN = 15 * mm
CONTENT_W = W - 2 * MARGIN

# ── Styles ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kwargs):
    return ParagraphStyle(name, **kwargs)

TITLE_STYLE = S('title', fontName='Helvetica-Bold', fontSize=28, textColor=WHITE,
                alignment=TA_CENTER, spaceAfter=4, spaceBefore=0, leading=34)
SUBTITLE_STYLE = S('subtitle', fontName='Helvetica-Bold', fontSize=14, textColor=ORANGE_MID,
                   alignment=TA_CENTER, spaceAfter=2, leading=18)
TAGLINE_STYLE = S('tagline', fontName='Helvetica', fontSize=11, textColor=WHITE,
                  alignment=TA_CENTER, spaceAfter=0)

H2_STYLE = S('h2', fontName='Helvetica-Bold', fontSize=15, textColor=GREEN,
             spaceBefore=12, spaceAfter=4, leading=20)
H3_STYLE = S('h3', fontName='Helvetica-Bold', fontSize=11, textColor=BLACK,
             spaceBefore=8, spaceAfter=3, leading=14)
BODY_STYLE = S('body', fontName='Helvetica', fontSize=10, textColor=BLACK,
               spaceBefore=3, spaceAfter=3, leading=14)
SMALL_STYLE = S('small', fontName='Helvetica', fontSize=8, textColor=GRAY,
                spaceBefore=2, spaceAfter=2, leading=11)
ITALIC_STYLE = S('italic', fontName='Helvetica-Oblique', fontSize=9, textColor=GRAY,
                 spaceBefore=2, spaceAfter=2, leading=12)
CENTER_BODY = S('center_body', fontName='Helvetica', fontSize=10, textColor=BLACK,
                alignment=TA_CENTER, spaceBefore=3, spaceAfter=3, leading=14)
BIG_ORANGE = S('big_orange', fontName='Helvetica-Bold', fontSize=24, textColor=ORANGE,
               alignment=TA_CENTER, spaceBefore=6, spaceAfter=4, leading=30)
BIG_GREEN = S('big_green', fontName='Helvetica-Bold', fontSize=16, textColor=GREEN,
              alignment=TA_CENTER, spaceBefore=4, spaceAfter=4, leading=20)
SLOGAN_STYLE = S('slogan', fontName='Helvetica-Bold', fontSize=18, textColor=WHITE,
                 alignment=TA_CENTER, spaceBefore=0, spaceAfter=4, leading=24)
SLOGAN_SUB = S('slogan_sub', fontName='Helvetica-Oblique', fontSize=11, textColor=ORANGE_MID,
               alignment=TA_CENTER, spaceBefore=0, spaceAfter=0, leading=15)

WARNING_STYLE = S('warn', fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#555500'),
                  alignment=TA_LEFT, leading=11)

def ts(*args):
    return TableStyle(list(args))

def box_table(content_rows, bg=GRAY_LIGHT, border_color=GRAY_MID):
    t = Table(content_rows, colWidths=[CONTENT_W])
    t.setStyle(ts(
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ))
    return t

def hr(color=GREEN_MID, thickness=1):
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)

# ── Callbacks de page ────────────────────────────────────────────────────────
def on_first_page(canvas, doc):
    W, H = A4
    # Fond header
    canvas.setFillColor(GREEN_DARK)
    canvas.rect(0, H - 60*mm, W, 60*mm, fill=1, stroke=0)
    # Bande orange
    canvas.setFillColor(ORANGE)
    canvas.rect(0, H - 64*mm, W, 4*mm, fill=1, stroke=0)
    # Logo texte
    canvas.setFont('Helvetica-Bold', 32)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(W/2, H - 22*mm, 'TERRASOCIAL')
    canvas.setFont('Helvetica', 12)
    canvas.setFillColor(ORANGE_MID)
    canvas.drawCentredString(W/2, H - 30*mm, 'par MANO VERDE INC SA')
    # Slogan principal
    canvas.setFont('Helvetica-Bold', 15)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(W/2, H - 42*mm, 'Devenez proprietaire de votre terrain au Cameroun')
    canvas.setFont('Helvetica', 11)
    canvas.setFillColor(ORANGE_MID)
    canvas.drawCentredString(W/2, H - 50*mm, 'Paiement echelonne sur 12 a 36 mois | Des 1 500 FCFA/jour')
    # Pied de page
    canvas.setFillColor(GREEN_DARK)
    canvas.rect(0, 0, W, 8*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(W/2, 2.5*mm,
        'TERRASOCIAL - MANO VERDE INC SA | Yaounde, Cameroun | direction@manovende.com | +237 651 98 28 78')

def on_later_page(canvas, doc):
    W, H = A4
    # Header compact
    canvas.setFillColor(GREEN)
    canvas.rect(0, H - 12*mm, W, 12*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(WHITE)
    canvas.drawString(MARGIN, H - 8*mm, 'TERRASOCIAL — MANO VERDE INC SA')
    canvas.drawRightString(W - MARGIN, H - 8*mm, f'Page {doc.page}')
    # Pied de page
    canvas.setFillColor(GREEN_DARK)
    canvas.rect(0, 0, W, 8*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(WHITE)
    canvas.drawCentredString(W/2, 2.5*mm,
        'direction@manovende.com | +237 651 98 28 78 | Fevrier 2026')

# ── Contenu ───────────────────────────────────────────────────────────────────
story = []
story.append(Spacer(1, 60*mm))  # espace pour le header first page

# AVERTISSEMENT
warning_data = [[Paragraph(
    '<b>AVERTISSEMENT LEGAL :</b> TERRASOCIAL est un service de vente de terrains a paiement echelonne. '
    'Ce service N\'est NI une banque, NI une microfinance, NI une tontine. Nous ne collectons pas d\'epargne '
    'et n\'accordons pas de credit. (Reglement COBAC R-2021/01)',
    WARNING_STYLE
)]]
warn_t = Table(warning_data, colWidths=[CONTENT_W])
warn_t.setStyle(ts(
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFDE7')),
    ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#F9A825')),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
))
story.append(warn_t)
story.append(Spacer(1, 6*mm))

# ── SECTION 1 : FRAIS DE DOSSIER MIS EN AVANT ────────────────────────────────
story.append(hr(GREEN))
story.append(Paragraph('📋  Ouverture de Dossier', H2_STYLE))

dossier_data = [[
    Table([[
        [Paragraph('10 000 FCFA', BIG_ORANGE)],
        [Paragraph('Frais d\'ouverture de dossier', BIG_GREEN)],
        [Paragraph('Paiement unique a la souscription — aucun acompte en %', CENTER_BODY)],
    ]], colWidths=[CONTENT_W * 0.48]),
    Table([[
        [Paragraph('Inclus :', H3_STYLE)],
        [Paragraph('✅  Ouverture et traitement du dossier', BODY_STYLE)],
        [Paragraph('✅  Blocage du lot a votre nom', BODY_STYLE)],
        [Paragraph('✅  Remboursable sous 7 jours (droit de retractation)', BODY_STYLE)],
        [Paragraph('✅  Aucun autre frais avant le debut des versements', BODY_STYLE)],
    ]], colWidths=[CONTENT_W * 0.48]),
]]
dt = Table(dossier_data, colWidths=[CONTENT_W * 0.48, CONTENT_W * 0.52])
dt.setStyle(ts(
    ('BACKGROUND', (0,0), (0,0), GREEN_LIGHT),
    ('BACKGROUND', (1,0), (1,0), GRAY_LIGHT),
    ('BOX', (0,0), (-1,-1), 0.5, GREEN_MID),
    ('INNERGRID', (0,0), (-1,-1), 0.5, GREEN_MID),
    ('TOPPADDING', (0,0), (-1,-1), 10),
    ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
))
story.append(dt)
story.append(Spacer(1, 6*mm))

# ── SECTION 2 : SLOGAN 2 BIERES ──────────────────────────────────────────────
slogan_data = [[
    Paragraph('🍺🍺', BIG_ORANGE),
    Paragraph(
        '« Le prix de 2 bieres par jour\npour votre terrain titre ! »',
        SLOGAN_STYLE
    ),
    Paragraph('2 bieres ≈ 1 500 FCFA/jour\nversement minimum journalier', SLOGAN_SUB),
]]
sl_t = Table([slogan_data], colWidths=[CONTENT_W * 0.12, CONTENT_W * 0.56, CONTENT_W * 0.32])
sl_t.setStyle(ts(
    ('BACKGROUND', (0,0), (-1,-1), ORANGE_DARK),
    ('ROUNDEDCORNERS', [8,8,8,8]),
    ('TOPPADDING', (0,0), (-1,-1), 14),
    ('BOTTOMPADDING', (0,0), (-1,-1), 14),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
))
story.append(sl_t)
story.append(Spacer(1, 6*mm))

# ── SECTION 3 : MODES DE VERSEMENT ───────────────────────────────────────────
story.append(hr(GREEN))
story.append(Paragraph('💳  Deux Modes de Versement au Choix', H2_STYLE))

modes_data = [
    [
        Paragraph('📅  Mode MENSUEL', S('mh', fontName='Helvetica-Bold', fontSize=13, textColor=GREEN, alignment=TA_CENTER)),
        Paragraph('🗓️  Mode JOURNALIER', S('mh2', fontName='Helvetica-Bold', fontSize=13, textColor=ORANGE_DARK, alignment=TA_CENTER)),
    ],
    [
        Paragraph('Payez une fois par mois\nla mensualite convenue au contrat.', CENTER_BODY),
        Paragraph('Versez chaque jour a partir de\n1 500 FCFA — sans attendre la fin du mois.', CENTER_BODY),
    ],
    [
        Paragraph('✅  Mensualites sur 12, 24 ou 36 mois\n✅  Prelevement regulier\n✅  Calendrier precis', BODY_STYLE),
        Paragraph('✅  A partir de 1 500 FCFA/jour\n✅  Paiements en avance acceptes\n✅  Orange Money / MTN MoMo 24h/7j', BODY_STYLE),
    ],
]
mt = Table(modes_data, colWidths=[CONTENT_W * 0.49, CONTENT_W * 0.49],
           spaceBefore=2, spaceAfter=2)
mt.setStyle(ts(
    ('BACKGROUND', (0,0), (0,-1), GREEN_LIGHT),
    ('BACKGROUND', (1,0), (1,-1), ORANGE_LIGHT),
    ('BOX', (0,0), (0,-1), 1, GREEN),
    ('BOX', (1,0), (1,-1), 1, ORANGE),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LINEBELOW', (0,0), (-1,-2), 0.5, GRAY_MID),
    ('LINEABOVE', (0,1), (-1,-1), 0.5, GRAY_MID),
))
story.append(mt)
story.append(Spacer(1, 5*mm))

# ── SECTION 4 : NOS LOTS ─────────────────────────────────────────────────────
story.append(hr(GREEN))
story.append(Paragraph('🏡  Nos Lots Disponibles', H2_STYLE))

lots_header = ['Lot', 'Superficie', 'Prix Total', 'Mensualite (24m)', 'Journalier min.', 'Versements/mois']
lots_data = [
    ['Standard', '500 m²', '500 000 FCFA', '~21 000 FCFA', '1 500 FCFA', '14 j'],
    ['Confort',  '750 m²', '750 000 FCFA', '~25 000 FCFA', '1 500 FCFA', '17 j'],
    ['Premium', '1 000 m²','1 000 000 FCFA','~28 000 FCFA','1 500 FCFA', '19 j'],
]
col_w = [CONTENT_W * f for f in [0.14, 0.12, 0.19, 0.19, 0.18, 0.18]]
lots_t = Table([lots_header] + lots_data, colWidths=col_w)
lots_t.setStyle(ts(
    ('BACKGROUND', (0,0), (-1,0), GREEN),
    ('TEXTCOLOR', (0,0), (-1,0), WHITE),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('INNERGRID', (0,0), (-1,-1), 0.3, GRAY_MID),
    ('BOX', (0,0), (-1,-1), 0.5, GREEN),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
))
story.append(lots_t)
story.append(Paragraph(
    '<i>Les mensualites sont indicatives (lot standard, duree 24 mois). '
    'Le versement journalier minimum de 1 500 FCFA est valable pour tous les lots.</i>',
    ITALIC_STYLE
))
story.append(Spacer(1, 5*mm))

# ── SECTION 5 : EXEMPLE CONCRET ──────────────────────────────────────────────
story.append(hr(ORANGE))
story.append(Paragraph('💡  Exemple Concret — Lot Standard 500m²', H2_STYLE))

ex_data = [
    ['Frais d\'ouverture de dossier (unique):', '10 000 FCFA'],
    ['Prix total du lot:', '500 000 FCFA'],
    ['Mensualite (plan 24 mois):', '~21 000 FCFA/mois'],
    ['En mode journalier :', '14 versements de 1 500 FCFA = 1 mois paye'],
    ['Paiement en avance :', '3 000 FCFA = 2 jours | 10 500 FCFA = 7 jours'],
]
ex_t = Table(ex_data, colWidths=[CONTENT_W * 0.55, CONTENT_W * 0.45])
ex_t.setStyle(ts(
    ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
    ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
    ('FONTSIZE', (0,0), (-1,-1), 10),
    ('TEXTCOLOR', (1,0), (1,-1), GREEN_DARK),
    ('BACKGROUND', (0,0), (-1,0), GREEN_LIGHT),
    ('BACKGROUND', (0,2), (-1,2), ORANGE_LIGHT),
    ('BACKGROUND', (0,3), (-1,4), GREEN_LIGHT),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ('INNERGRID', (0,0), (-1,-1), 0.3, GRAY_MID),
    ('BOX', (0,0), (-1,-1), 0.5, GREEN),
))
story.append(ex_t)
story.append(Spacer(1, 5*mm))

# ── SECTION 6 : PROCESSUS ────────────────────────────────────────────────────
story.append(hr(GREEN))
story.append(Paragraph('✅  Processus en 5 Etapes', H2_STYLE))

steps = [
    ('1', 'Choisissez votre lot', 'Parcourez nos lots disponibles sur le site ou sur demande a notre equipe.'),
    ('2', 'Reservez en ligne', 'Remplissez le formulaire et payez 10 000 FCFA de frais de dossier pour bloquer votre lot.'),
    ('3', 'Signez le contrat', 'Validez votre contrat de reservation avec le mode de versement et la duree choisis.'),
    ('4', 'Payez a votre rythme', 'Versez chaque mois ou chaque jour via Orange Money / MTN MoMo — meme en avance !'),
    ('5', 'Recevez votre titre', 'Apres paiement integral, recevez votre acte de cession et titre foncier.'),
]
for num, title, desc in steps:
    step_data = [[
        Paragraph(num, S(f's{num}', fontName='Helvetica-Bold', fontSize=16, textColor=WHITE, alignment=TA_CENTER)),
        Table([
            [Paragraph(title, H3_STYLE)],
            [Paragraph(desc, BODY_STYLE)],
        ], colWidths=[CONTENT_W * 0.82]),
    ]]
    st = Table(step_data, colWidths=[CONTENT_W * 0.10, CONTENT_W * 0.88], spaceBefore=2, spaceAfter=2)
    st.setStyle(ts(
        ('BACKGROUND', (0,0), (0,0), GREEN),
        ('BACKGROUND', (1,0), (1,0), WHITE),
        ('BOX', (0,0), (-1,-1), 0.3, GREEN_MID),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ))
    story.append(st)

story.append(Spacer(1, 5*mm))

# ── SECTION 7 : MOYENS DE PAIEMENT ───────────────────────────────────────────
story.append(hr(GREEN))
story.append(Paragraph('💳  Moyens de Paiement Acceptes', H2_STYLE))

pay_data = [['🟠 Orange Money', '🟡 MTN Mobile Money', '🏦 Virement Bancaire', '💳 Carte Bancaire', '💵 Especes']]
pay_t = Table(pay_data, colWidths=[CONTENT_W / 5] * 5)
pay_t.setStyle(ts(
    ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 10),
    ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ('INNERGRID', (0,0), (-1,-1), 0.5, GRAY_MID),
    ('BOX', (0,0), (-1,-1), 0.5, GREEN),
    ('ROWBACKGROUNDS', (0,0), (-1,-1), [GRAY_LIGHT]),
))
story.append(pay_t)
story.append(Spacer(1, 5*mm))

# ── SECTION 8 : CONTACT ──────────────────────────────────────────────────────
story.append(hr(ORANGE))
story.append(Paragraph('📞  Nous Contacter', H2_STYLE))

contact_data = [
    [Paragraph('Site web', H3_STYLE), Paragraph('social.manovende.com', BODY_STYLE)],
    [Paragraph('Email', H3_STYLE), Paragraph('direction@manovende.com | infos@manoverde.com', BODY_STYLE)],
    [Paragraph('Telephone', H3_STYLE), Paragraph('+237 651 98 28 78 | +237 696 87 58 95', BODY_STYLE)],
    [Paragraph('WhatsApp', H3_STYLE), Paragraph('+237 651 98 28 78', BODY_STYLE)],
    [Paragraph('Adresse', H3_STYLE), Paragraph('Yaounde, Cameroun — Quartier Odza', BODY_STYLE)],
]
ct = Table(contact_data, colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.75])
ct.setStyle(ts(
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ('LINEBELOW', (0,0), (-1,-2), 0.3, GRAY_MID),
    ('BACKGROUND', (0,0), (-1,-1), GRAY_LIGHT),
    ('BOX', (0,0), (-1,-1), 0.5, GREEN_MID),
))
story.append(ct)
story.append(Spacer(1, 8*mm))

# ── FOOTER LEGAL ─────────────────────────────────────────────────────────────
legal_data = [[Paragraph(
    '<b>AVERTISSEMENT LEGAL :</b> TERRASOCIAL est exploite par MANO VERDE INC SA, societe anonyme de droit camerounais. '
    'Ce service est une vente immobiliere a paiement echelonne (credit-vendeur). Il ne constitue pas une '
    'operation de banque, de credit ou de microfinance. Document produit en Fevrier 2026.',
    WARNING_STYLE
)]]
fl = Table(legal_data, colWidths=[CONTENT_W])
fl.setStyle(ts(
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F9F9E8')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CCCC88')),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
))
story.append(fl)

# ── CONSTRUCTION ─────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUT_FILE,
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=65*mm, bottomMargin=12*mm,
    title='Prospectus TERRASOCIAL - Fevrier 2026',
    author='MANO VERDE INC SA',
    subject='Vente de terrains a paiement echelonne - Cameroun',
)
doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_page)
print(f'✅ Prospectus_TERRASOCIAL_Fev2026.pdf ({round(os.path.getsize(OUT_FILE)/1024)} Ko)')
