/**
 * TERRASOCIAL — Génération des documents officiels mis à jour
 * Nouveau modèle : Frais de dossier 10 000 FCFA + versements mensuel/journalier
 * Suppression : acompte 10%
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, PageBreak,
  ExternalHyperlink
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUT_DIR = process.argv[2] || '/sessions/nice-quirky-tesla/mnt/Code_source';

// ── Couleurs ────────────────────────────────────────────────────────────────
const GREEN       = '2E7D32';
const GREEN_LIGHT = 'E8F5E9';
const GREEN_MID   = 'C8E6C9';
const ORANGE      = 'FF9800';
const ORANGE_LIGHT= 'FFF8E1';
const GRAY_LIGHT  = 'F5F5F5';
const WHITE       = 'FFFFFF';
const BLACK       = '333333';

// ── Helpers ──────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(text, opts = {}) {
  const { bold = false, shade = WHITE, align = AlignmentType.LEFT, width = 2255, colSpan } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text), bold, size: 20, font: 'Arial', color: BLACK })]
    })]
  });
}

function cellH(text, opts = {}) {
  return cell(text, { bold: true, shade: GREEN_LIGHT, ...opts });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: GREEN })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GREEN, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Arial', color: GREEN })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: BLACK })]
  });
}

function p(text, opts = {}) {
  const { bold = false, italic = false, color = BLACK, size = 20, spacing = { before: 60, after: 60 }, align } = opts;
  return new Paragraph({
    alignment: align,
    spacing,
    children: [new TextRun({ text, bold, italic, size, font: 'Arial', color })]
  });
}

function bullet(text, opts = {}) {
  const { bold = false } = opts;
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, bold, size: 20, font: 'Arial', color: BLACK })]
  });
}

function space(n = 1) {
  return new Paragraph({ spacing: { before: 60 * n, after: 0 }, children: [new TextRun('')] });
}

function infoBox(lines, shade = ORANGE_LIGHT) {
  const cellContent = lines.map((line, i) =>
    new Paragraph({
      spacing: { before: i === 0 ? 0 : 40, after: i === lines.length - 1 ? 0 : 40 },
      children: Array.isArray(line)
        ? line.map(seg => new TextRun({ text: seg.text || seg, bold: !!seg.bold, size: 20, font: 'Arial', color: BLACK }))
        : [new TextRun({ text: String(line), size: 20, font: 'Arial', color: BLACK })]
    })
  );
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders,
        shading: { fill: shade, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: cellContent
      })]
    })]
  });
}

function makeHeader(title, subtitle) {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN } },
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'TERRASOCIAL ', bold: true, size: 22, font: 'Arial', color: GREEN }),
          new TextRun({ text: '— MANO VERDE INC SA', size: 22, font: 'Arial', color: BLACK }),
          new TextRun({ text: `  |  ${title}`, size: 18, font: 'Arial', color: '888888', italics: true }),
        ]
      })
    ]
  });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
        spacing: { before: 80 },
        tabStops: [{ type: 'right', position: 9026 }],
        children: [
          new TextRun({ text: 'MANO VERDE INC SA — direction@manovende.com — +237 651 98 28 78', size: 16, font: 'Arial', color: '888888' }),
          new TextRun({ text: '\tPage ', size: 16, font: 'Arial', color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '888888' }),
        ]
      })
    ]
  });
}

const NUMBERING = {
  config: [
    { reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'numbers',
      levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. CGV — Conditions Générales de Vente
// ═══════════════════════════════════════════════════════════════════════════
function createCGV() {
  const children = [
    // Titre
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'CONDITIONS GÉNÉRALES DE VENTE', bold: true, size: 36, font: 'Arial', color: GREEN })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'TERRASOCIAL — MANO VERDE INC SA', bold: true, size: 24, font: 'Arial', color: BLACK })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: 'Dernière mise à jour : Février 2026', size: 18, font: 'Arial', color: '888888', italics: true })]
    }),

    infoBox([
      [{ text: '⚠️  AVERTISSEMENT IMPORTANT : ', bold: true }, { text: 'TERRASOCIAL est un service de vente de terrains à paiement échelonné exploité par MANO VERDE INC SA. Ce service n\'est NI une banque, NI une microfinance, NI une tontine, NI un établissement de crédit. Nous ne collectons pas d\'épargne publique et nous n\'accordons pas de crédit.' }]
    ], 'FFF3E0'),
    space(2),

    h2('Article 1 — Objet'),
    p('Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre MANO VERDE INC SA, société anonyme de droit camerounais, exploitant le service TERRASOCIAL, et toute personne physique ou morale souhaitant acquérir un terrain proposé à la vente.'),
    p('Le service TERRASOCIAL propose la vente de terrains à usage d\'habitation situés dans la région du Centre (Cameroun), avec une facilité de paiement échelonné sur une durée de 12 à 36 mois.'),
    space(),

    h2('Article 2 — Identité du Vendeur'),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [2800, 6226],
      rows: [
        new TableRow({ children: [cellH('Raison sociale', { width: 2800 }), cell('MANO VERDE INC SA', { bold: true, width: 6226 })] }),
        new TableRow({ children: [cellH('Forme juridique', { width: 2800 }), cell('Société Anonyme', { width: 6226 })] }),
        new TableRow({ children: [cellH('Siège social', { width: 2800 }), cell('Yaoundé, Cameroun — Quartier Odza', { width: 6226 })] }),
        new TableRow({ children: [cellH('Téléphone', { width: 2800 }), cell('+237 651 98 28 78 / +237 696 87 58 95', { width: 6226 })] }),
        new TableRow({ children: [cellH('Email', { width: 2800 }), cell('direction@manovende.com — infos@manoverde.com', { width: 6226 })] }),
      ]
    }),
    space(),

    h2('Article 3 — Nature Juridique de l\'Opération'),
    p('L\'opération proposée par TERRASOCIAL est une vente immobilière à paiement échelonné (crédit-vendeur). Elle ne constitue pas une opération de banque, de crédit ou de microfinance au sens du Règlement COBAC R-2021/01 et du Code Monétaire de la CEMAC.'),
    space(),

    h2('Article 4 — Produits Proposés'),
    h3('4.1 Description des lots'),
    p('Les terrains proposés à la vente sont situés dans la région du Centre, à proximité de Yaoundé. Chaque lot est identifié par un numéro, une superficie et une localisation précise.'),
    h3('4.2 Garanties foncières'),
    p('Tous les terrains vendus par TERRASOCIAL sont issus de titres fonciers valides, régulièrement enregistrés auprès de la Conservation Foncière.'),
    space(),

    h2('Article 5 — Prix et Modalités de Paiement'),
    h3('5.1 Prix'),
    p('Les prix sont exprimés en Francs CFA (XAF) et comprennent : le prix du terrain, les frais de bornage et les frais de dossier. Les frais de notaire et de mutation sont à la charge de l\'acquéreur.'),
    space(0.5),

    h3('5.2 Paiement échelonné'),
    p('Le paiement s\'effectue selon le modèle suivant :'),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3000, 6026],
      rows: [
        new TableRow({ children: [cellH('Frais d\'ouverture de dossier', { width: 3000 }), cell('10 000 FCFA — Paiement unique et forfaitaire à la souscription (non déduits du prix du lot)', { bold: true, width: 6026 })] }),
        new TableRow({ children: [cellH('Solde du lot', { width: 3000 }), cell('Payable en mensualités sur 12, 24 ou 36 mois OU par versements journaliers (voir art. 5.2 bis)', { width: 6026 })] }),
        new TableRow({ children: [cellH('Intérêts', { width: 3000 }), cell('Aucun intérêt. Le prix total reste identique quelle que soit la durée.', { width: 6026 })] }),
      ]
    }),
    p('Il n\'est pas exigé d\'acompte en pourcentage du prix du lot.', { bold: true }),
    space(0.5),

    h3('5.2 bis — Versements Journaliers (Facilité de Micro-Paiement)'),
    infoBox([
      [{ text: '🍺  « Le prix de 2 bières par jour pour votre terrain titré ! »', bold: true }],
      ['2 bières ≈ 1 500 FCFA — le versement journalier minimum qui vous rapproche chaque jour de la propriété.']
    ], GREEN_LIGHT),
    space(0.5),
    p('En complément du calendrier mensuel, l\'acquéreur peut s\'acquitter de sa mensualité par versements journaliers selon les modalités ci-dessous :'),
    bullet('Montant minimum journalier : 1 500 FCFA par jour', { bold: true }),
    bullet('Paiements anticipés autorisés : plusieurs jours en avance en un seul virement (ex. : 3 000 FCFA = 2 jours, 10 500 FCFA = 7 jours)'),
    bullet('Cumul : plusieurs versements dans un même mois s\'additionnent pour créditer la mensualité en cours'),
    bullet('Canal privilégié : Orange Money et MTN Mobile Money, 24h/24, 7j/7'),
    space(0.5),
    p('Tableau indicatif des équivalences journalières :', { italic: true }),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3000, 3013, 3013],
      rows: [
        new TableRow({ children: [cellH('Lot', { width: 3000 }), cellH('Mensualité indicative', { width: 3013 }), cellH('Versements à 1 500 Fr/j', { width: 3013 })] }),
        new TableRow({ children: [cell('Standard 500 m²', { width: 3000 }), cell('21 000 FCFA', { width: 3013, align: AlignmentType.CENTER }), cell('14 versements/mois', { width: 3013, align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell('Confort 750 m²', { width: 3000, shade: GRAY_LIGHT }), cell('25 000 FCFA', { width: 3013, align: AlignmentType.CENTER, shade: GRAY_LIGHT }), cell('17 versements/mois', { width: 3013, align: AlignmentType.CENTER, shade: GRAY_LIGHT })] }),
        new TableRow({ children: [cell('Premium 1 000 m²', { width: 3000 }), cell('28 000 FCFA', { width: 3013, align: AlignmentType.CENTER }), cell('19 versements/mois', { width: 3013, align: AlignmentType.CENTER })] }),
      ]
    }),
    p('Cette facilité ne modifie pas le prix total ni la durée du plan contractuel.', { italic: true }),
    space(),

    h3('5.3 Moyens de paiement acceptés'),
    bullet('Orange Money'), bullet('MTN Mobile Money'), bullet('Virement bancaire'),
    bullet('Carte bancaire'), bullet('Chèque certifié'), bullet('Espèces (dans les limites légales)'),
    space(),

    h2('Article 6 — Réservation et Contrat'),
    h3('6.1 Réservation'),
    p('La réservation d\'un lot est effective après versement des frais d\'ouverture de dossier de 10 000 FCFA (forfait unique) et signature du contrat de réservation. Le lot est alors bloqué au nom du client pendant toute la durée du paiement. Aucun acompte supplémentaire en pourcentage du prix du lot n\'est exigé.'),
    h3('6.2 Droit de rétractation'),
    p('Conformément à la législation camerounaise, l\'acquéreur dispose d\'un délai de 7 jours calendaires à compter de la signature du contrat pour exercer son droit de rétractation, sans pénalité. Les frais d\'ouverture de dossier (10 000 FCFA) seront intégralement remboursés dans un délai de 14 jours.'),
    space(),

    h2('Article 7 — Conditions Suspensives et Résolutoires'),
    h3('7.1 Clause résolutoire'),
    p('En cas de défaut de paiement de deux mensualités consécutives (ou l\'équivalent en versements journaliers), le vendeur pourra, après mise en demeure restée sans effet pendant 15 jours, prononcer la résolution de plein droit de la vente.'),
    h3('7.2 Conséquences de la résolution'),
    p('En cas de résolution pour défaut de paiement, les sommes versées seront remboursées au client, déduction faite d\'une indemnité forfaitaire de 15% du prix total, correspondant aux frais de gestion et de remise en vente.'),
    space(),

    h2('Article 8 — Jouissance Anticipée'),
    p('L\'acquéreur peut bénéficier d\'une mise en jouissance anticipée du terrain après paiement d\'au moins 50% du prix total, matérialisée par un Procès-Verbal de mise en jouissance. Cette jouissance ne confère pas la propriété, acquise uniquement après paiement intégral.'),
    space(),

    h2('Article 9 — Transfert de Propriété'),
    p('Le transfert de propriété intervient après :'),
    bullet('Paiement intégral du prix de vente'),
    bullet('Signature de l\'acte de cession devant notaire'),
    bullet('Accomplissement des formalités de mutation foncière'),
    space(),

    h2('Article 10 — Responsabilité'),
    p('MANO VERDE INC SA s\'engage à fournir des terrains libres de tout litige et régulièrement immatriculés.'),
    space(),

    h2('Article 11 — Protection des Données Personnelles'),
    p('Les données personnelles collectées sont traitées conformément à notre Politique de Confidentialité et à la réglementation en vigueur.'),
    space(),

    h2('Article 12 — Litiges'),
    p('Les présentes CGV sont régies par le droit camerounais. En cas de litige, les parties s\'engagent à rechercher une solution amiable. À défaut, les tribunaux de Yaoundé seront seuls compétents.'),
    space(),

    h2('Article 13 — Modification des CGV'),
    p('Les présentes CGV peuvent être modifiées à tout moment. Les conditions applicables sont celles en vigueur au moment de la signature du contrat de réservation.'),
  ];

  return new Document({
    numbering: NUMBERING,
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BLACK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: BLACK },
          paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 }
        }
      },
      headers: { default: makeHeader('Conditions Générales de Vente') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Politique de Paiement
// ═══════════════════════════════════════════════════════════════════════════
function createPolitiquePaiement() {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'POLITIQUE DE PAIEMENT ÉCHELONNÉ', bold: true, size: 36, font: 'Arial', color: GREEN })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'TERRASOCIAL — MANO VERDE INC SA', bold: true, size: 24, font: 'Arial', color: BLACK })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: 'Mise à jour : 22 Février 2026', size: 18, font: 'Arial', color: '888888', italics: true })]
    }),

    infoBox([['Le paiement échelonné TERRASOCIAL est un mécanisme de vente immobilière (crédit-vendeur) sans activité bancaire ni microfinance.']], 'FFF3E0'),
    space(2),

    h2('1. Principes généraux'),
    bullet('Frais d\'ouverture de dossier : 10 000 FCFA (forfait unique, dû à la souscription — aucun acompte en % du prix du lot)', { bold: true }),
    bullet('Prix du lot payable en totalité par mensualités sur 12, 24 ou 36 mois, ou par versements journaliers'),
    bullet('Aucun intérêt appliqué sur le montant total convenu au contrat'),
    space(),

    h2('1 bis. Versements Journaliers — Facilité de Micro-Paiement'),
    infoBox([
      [{ text: '🍺  « Le prix de 2 bières par jour pour votre terrain titré ! »', bold: true }],
      ['2 bières ≈ 1 500 FCFA — versement journalier minimum pour accéder à la propriété.']
    ], GREEN_LIGHT),
    space(0.5),
    p('En complément des mensualités, l\'acquéreur peut s\'acquitter de son plan de paiement par micro-versements journaliers d\'un minimum de 1 500 FCFA par jour.'),
    bullet('Versement minimum : 1 500 FCFA / jour', { bold: true }),
    bullet('Paiements anticipés autorisés (ex : 4 500 FCFA = 3 jours)'),
    bullet('Cumul dans le mois : tous les versements s\'additionnent pour couvrir la mensualité en cours'),
    bullet('Sans frais supplémentaires — prix contractuel inchangé'),
    bullet('Disponible via Orange Money et MTN Mobile Money, 24h/24, 7j/7'),
    space(0.5),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [2256, 2257, 2257, 2256],
      rows: [
        new TableRow({ children: [cellH('Lot', { width: 2256 }), cellH('Mensualité indicative', { width: 2257 }), cellH('Versements à 1 500 Fr/j', { width: 2257 }), cellH('Équivalent populaire', { width: 2256 })] }),
        new TableRow({ children: [cell('Standard 500 m²', { width: 2256 }), cell('21 000 FCFA', { width: 2257, align: AlignmentType.CENTER }), cell('14 versements/mois', { width: 2257, align: AlignmentType.CENTER }), cell('2 bières × 14 jours', { width: 2256, align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell('Confort 750 m²', { width: 2256, shade: GRAY_LIGHT }), cell('25 000 FCFA', { width: 2257, align: AlignmentType.CENTER, shade: GRAY_LIGHT }), cell('17 versements/mois', { width: 2257, align: AlignmentType.CENTER, shade: GRAY_LIGHT }), cell('2 bières × 17 jours', { width: 2256, align: AlignmentType.CENTER, shade: GRAY_LIGHT })] }),
        new TableRow({ children: [cell('Premium 1 000 m²', { width: 2256 }), cell('28 000 FCFA', { width: 2257, align: AlignmentType.CENTER }), cell('19 versements/mois', { width: 2257, align: AlignmentType.CENTER }), cell('2 bières × 19 jours', { width: 2256, align: AlignmentType.CENTER })] }),
      ]
    }),
    p('Les mensualités sont indicatives et varient selon le lot et la durée du plan retenu.', { italic: true }),
    space(),

    h2('2. Calendrier type'),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [2256, 2257, 2257, 2256],
      rows: [
        new TableRow({ children: [cellH('Durée', { width: 2256 }), cellH('Frais de dossier (unique)', { width: 2257 }), cellH('Échéances mensuelles', { width: 2257 }), cellH('Ou versements journaliers', { width: 2256 })] }),
        new TableRow({ children: [cell('12 mois', { width: 2256 }), cell('10 000 FCFA', { width: 2257, align: AlignmentType.CENTER }), cell('12 mensualités', { width: 2257, align: AlignmentType.CENTER }), cell('dès 1 500 FCFA/jour', { width: 2256, align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell('24 mois', { width: 2256, shade: GRAY_LIGHT }), cell('10 000 FCFA', { width: 2257, align: AlignmentType.CENTER, shade: GRAY_LIGHT }), cell('24 mensualités', { width: 2257, align: AlignmentType.CENTER, shade: GRAY_LIGHT }), cell('dès 1 500 FCFA/jour', { width: 2256, align: AlignmentType.CENTER, shade: GRAY_LIGHT })] }),
        new TableRow({ children: [cell('36 mois', { width: 2256 }), cell('10 000 FCFA', { width: 2257, align: AlignmentType.CENTER }), cell('36 mensualités', { width: 2257, align: AlignmentType.CENTER }), cell('dès 1 500 FCFA/jour', { width: 2256, align: AlignmentType.CENTER })] }),
      ]
    }),
    space(),

    h2('3. Modes de paiement acceptés'),
    bullet('Orange Money'), bullet('MTN Mobile Money'), bullet('Virement bancaire'),
    bullet('Carte bancaire'), bullet('Espèces (dans le cadre légal)'),
    space(),

    h2('4. Référence et preuve de paiement'),
    p('Chaque paiement doit inclure la référence client/contrat communiquée dans le tableau de bord. Un reçu est généré pour toute opération validée.'),
    space(),

    h2('5. Retards et incidents'),
    bullet('Un retard déclenche une alerte dans le tableau de bord client'),
    bullet('Après deux mensualités impayées (ou équivalent en versements journaliers non couverts), une mise en demeure peut être initiée'),
    bullet('Un plan de régularisation peut être proposé selon étude du dossier'),
    space(),

    h2('6. Indicateur de fiabilité'),
    p('Un score interne de fiabilité est calculé selon la ponctualité, le taux de couverture du plan et la régularité des paiements.'),
    space(),

    h2('7. Jouissance provisoire'),
    p('La jouissance provisoire peut être envisagée après un seuil minimal de paiement (ex : 50% du prix total).'),
    space(),

    h2('8. Contact paiement'),
    bullet('Email : direction@manovende.com'),
    bullet('Support : infos@manoverde.com'),
    bullet('Téléphone : +237 651 98 28 78'),
    bullet('Téléphone 2 : +237 696 87 58 95'),
  ];

  return new Document({
    numbering: NUMBERING,
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BLACK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: BLACK },
          paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 }
        }
      },
      headers: { default: makeHeader('Politique de Paiement Échelonné') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Contrat de Réservation (modèle)
// ═══════════════════════════════════════════════════════════════════════════
function createContratReservation() {
  const fieldLine = (label, blank = 40) => new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: `${label} : `, bold: true, size: 20, font: 'Arial', color: BLACK }),
      new TextRun({ text: '_'.repeat(blank), size: 20, font: 'Arial', color: '999999' }),
    ]
  });

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'CONTRAT DE RÉSERVATION DE LOT', bold: true, size: 36, font: 'Arial', color: GREEN })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'TERRASOCIAL — MANO VERDE INC SA', bold: true, size: 24, font: 'Arial', color: BLACK })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'N° Contrat : ____________________    Date : _______________', size: 20, font: 'Arial', color: '888888' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: 'Confidentiel — Document officiel', size: 18, font: 'Arial', color: '888888', italics: true })]
    }),

    infoBox([
      [{ text: 'AVERTISSEMENT : ', bold: true }, { text: 'Ce contrat est une vente immobilière à paiement échelonné (crédit-vendeur). TERRASOCIAL n\'est NI une banque NI une microfinance.' }]
    ], 'FFF3E0'),
    space(2),

    h2('ARTICLE 1 — PARTIES'),
    h3('1.1 Le Vendeur'),
    bullet('Dénomination : MANO VERDE INC SA (Service TERRASOCIAL)'),
    bullet('Siège : Yaoundé, Cameroun — Quartier Odza'),
    bullet('Contacts : +237 651 98 28 78 / direction@manovende.com'),
    space(0.5),
    h3('1.2 L\'Acquéreur'),
    fieldLine('Nom et Prénoms', 50),
    fieldLine('Date de naissance'),
    fieldLine('Lieu de naissance', 45),
    fieldLine('Nationalité', 30),
    fieldLine('Adresse complète', 45),
    fieldLine('Téléphone'),
    fieldLine('Email', 45),
    fieldLine('Pièce d\'identité (type et numéro)', 35),
    space(),

    h2('ARTICLE 2 — OBJET DE LA RÉSERVATION'),
    h3('2.1 Désignation du lot'),
    fieldLine('Numéro de lot', 30),
    fieldLine('Superficie', 20),
    fieldLine('Localisation', 45),
    fieldLine('Référence cadastrale / titre foncier', 35),
    space(0.5),
    h3('2.2 Prix et durée du plan'),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3000, 6026],
      rows: [
        new TableRow({ children: [cellH('Prix total du lot', { width: 3000 }), cell('_____________________ FCFA', { width: 6026 })] }),
        new TableRow({ children: [cellH('Frais d\'ouverture de dossier', { width: 3000 }), cell('10 000 FCFA (paiement unique à la signature — non déduits du prix)', { bold: true, width: 6026 })] }),
        new TableRow({ children: [cellH('Mode de versement choisi', { width: 3000 }), cell('☐  Mensuel    ☐  Journalier (dès 1 500 FCFA/j)', { width: 6026 })] }),
        new TableRow({ children: [cellH('Durée du plan', { width: 3000 }), cell('☐ 12 mois    ☐ 24 mois    ☐ 36 mois', { width: 6026 })] }),
        new TableRow({ children: [cellH('Mensualité indicative', { width: 3000 }), cell('_____________________ FCFA/mois', { width: 6026 })] }),
        new TableRow({ children: [cellH('Équivalent journalier', { width: 3000 }), cell('_____________________ versements de 1 500 FCFA = 1 mois', { width: 6026 })] }),
      ]
    }),
    space(),

    h2('ARTICLE 3 — CONDITIONS DE PAIEMENT'),
    p('3.1  Les frais d\'ouverture de dossier de 10 000 FCFA sont dus à la signature du présent contrat. Aucun acompte en pourcentage du prix du lot n\'est exigé.'),
    p('3.2  Le solde est payable selon le mode et la durée choisis à l\'article 2.2, sans intérêt.'),
    p('3.3  L\'acquéreur peut passer du mode mensuel au mode journalier à tout moment par notification écrite.'),
    p('3.4  Les versements journaliers sont acceptés à partir de 1 500 FCFA par jour. Les paiements anticipés sont autorisés.'),
    space(),

    h2('ARTICLE 4 — EFFETS DE LA RÉSERVATION'),
    p('4.1  Le lot est bloqué au nom de l\'acquéreur dès la signature du présent contrat et le paiement des frais de dossier.'),
    p('4.2  L\'acquéreur dispose d\'un droit de rétractation de 7 jours calendaires. Les frais de dossier sont remboursés intégralement dans ce délai.'),
    p('4.3  La jouissance anticipée peut être accordée après paiement de 50% du prix total.'),
    space(),

    h2('ARTICLE 5 — TRANSFERT DE PROPRIÉTÉ'),
    p('Le transfert de propriété intervient après paiement intégral du prix, signature de l\'acte notarié et accomplissement des formalités de mutation foncière.'),
    space(),

    h2('ARTICLE 6 — CLAUSE RÉSOLUTOIRE'),
    p('En cas de défaut de paiement de 2 mensualités consécutives (ou équivalent journalier non couvert), le vendeur pourra prononcer la résolution du contrat après mise en demeure de 15 jours, avec retenue de 15% à titre d\'indemnité.'),
    space(),

    h2('SIGNATURES'),
    space(2),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4513, 4513],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: 4513, type: WidthType.DXA },
              children: [
                p('Le Vendeur', { bold: true }),
                p('MANO VERDE INC SA'),
                p('Service TERRASOCIAL'),
                space(2),
                p('Signature et cachet : ____________________'),
              ]
            }),
            new TableCell({
              borders: noBorders,
              width: { size: 4513, type: WidthType.DXA },
              children: [
                p('L\'Acquéreur', { bold: true }),
                p('Nom : ____________________'),
                p('Lu et approuvé'),
                space(2),
                p('Signature : ____________________'),
              ]
            }),
          ]
        })
      ]
    }),
    space(),
    new Paragraph({
      spacing: { before: 200, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Fait à Yaoundé, le ______________________, en deux (2) exemplaires originaux.', size: 18, font: 'Arial', color: '888888', italics: true })]
    }),
  ];

  return new Document({
    numbering: NUMBERING,
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BLACK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 20, bold: true, font: 'Arial', color: BLACK },
          paragraph: { spacing: { before: 140, after: 40 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 }
        }
      },
      headers: { default: makeHeader('Contrat de Réservation') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Note de Mise à Jour Interne
// ═══════════════════════════════════════════════════════════════════════════
function createNoteMiseAJour() {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'NOTE INTERNE DE MISE À JOUR', bold: true, size: 32, font: 'Arial', color: GREEN })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'Nouveau Modèle de Paiement TERRASOCIAL — Février 2026', bold: true, size: 22, font: 'Arial', color: BLACK })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: 'Diffusion interne — MANO VERDE INC SA', size: 18, font: 'Arial', color: '888888', italics: true })]
    }),

    h2('1. Résumé des changements'),
    infoBox([
      [{ text: 'CHANGEMENT MAJEUR : ', bold: true }, { text: 'Suppression de l\'acompte de 10% du prix du lot. Remplacement par un forfait unique de 10 000 FCFA (frais d\'ouverture de dossier).' }]
    ], ORANGE_LIGHT),
    space(0.5),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4513, 4513],
      rows: [
        new TableRow({ children: [cellH('ANCIEN MODÈLE', { width: 4513 }), cellH('NOUVEAU MODÈLE', { width: 4513 })] }),
        new TableRow({ children: [cell('Acompte 10% du prix du lot\n(ex. 50 000 FCFA pour lot à 500 000 FCFA)', { width: 4513 }), cell('Frais de dossier : 10 000 FCFA fixe\n(quel que soit le prix du lot)', { width: 4513, bold: true })] }),
        new TableRow({ children: [cell('Mensualités uniquement', { width: 4513, shade: GRAY_LIGHT }), cell('Mensualités OU versements journaliers dès 1 500 FCFA/j', { width: 4513, shade: GRAY_LIGHT, bold: true })] }),
        new TableRow({ children: [cell('Pas de paiement journalier formalisé', { width: 4513 }), cell('Option journalière officielle dans tous les contrats', { width: 4513, bold: true })] }),
      ]
    }),
    space(),

    h2('2. Avantages client du nouveau modèle'),
    bullet('Barrière à l\'entrée réduite : 10 000 FCFA au lieu de 50 000–100 000 FCFA (10% d\'un lot)'),
    bullet('Flexibilité maximale : payer chaque jour à son rythme dès 1 500 FCFA'),
    bullet('Slogan fort : « 2 bières par jour pour votre terrain titré »'),
    bullet('Paiements anticipés autorisés : épargne active sans blocage'),
    space(),

    h2('3. Documents mis à jour'),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4000, 3026, 2000],
      rows: [
        new TableRow({ children: [cellH('Document', { width: 4000 }), cellH('Changement principal', { width: 3026 }), cellH('Statut', { width: 2000 })] }),
        new TableRow({ children: [cell('CGV — Art. 5.2 + 5.2 bis + 6.1', { width: 4000 }), cell('Acompte 10% → frais dossier 10k + versements journaliers', { width: 3026 }), cell('✅ Mis à jour', { bold: true, width: 2000 })] }),
        new TableRow({ children: [cell('Politique de Paiement', { width: 4000, shade: GRAY_LIGHT }), cell('Section 1 bis + calendrier mis à jour', { width: 3026, shade: GRAY_LIGHT }), cell('✅ Mis à jour', { bold: true, width: 2000, shade: GRAY_LIGHT })] }),
        new TableRow({ children: [cell('Contrat de Réservation', { width: 4000 }), cell('Frais dossier + mode versement dans le corps du contrat', { width: 3026 }), cell('✅ Mis à jour', { bold: true, width: 2000 })] }),
        new TableRow({ children: [cell('Prospectus commercial', { width: 4000, shade: GRAY_LIGHT }), cell('Slogan 2 bières + mode journalier + 10 000 FCFA', { width: 3026, shade: GRAY_LIGHT }), cell('✅ Mis à jour', { bold: true, width: 2000, shade: GRAY_LIGHT })] }),
        new TableRow({ children: [cell('Site web (index.html)', { width: 4000 }), cell('Simulateur + formulaire + lots dynamiques', { width: 3026 }), cell('✅ Déployé', { bold: true, width: 2000 })] }),
      ]
    }),
    space(),

    h2('4. Instructions pour l\'équipe commerciale'),
    bullet('À partir de maintenant, NE PAS demander d\'acompte de 10% aux clients'),
    bullet('Demander uniquement les 10 000 FCFA de frais d\'ouverture de dossier'),
    bullet('Proposer systématiquement le mode journalier comme option accessible'),
    bullet('Utiliser le slogan : « 2 bières par jour pour votre terrain titré ! »'),
    bullet('Si le client hésite : montrer le simulateur sur le site web (calcul journalier)'),
    space(),

    h2('5. Questions fréquentes'),
    h3('Les 10 000 FCFA sont-ils déduits du prix du lot ?'),
    p('Non. Les frais de dossier de 10 000 FCFA sont des frais administratifs séparés. Le prix du lot reste intégralement dû.'),
    h3('Que se passe-t-il si le client ne verse pas tous les jours ?'),
    p('Le client peut verser irrégulièrement, en avance, ou par mensualité complète. L\'essentiel est de couvrir chaque mensualité avant sa date d\'échéance.'),
    h3('Le mode journalier peut-il être changé en mensuel ?'),
    p('Oui, à tout moment sur demande écrite du client. Aucun frais supplémentaire.'),
  ];

  return new Document({
    numbering: NUMBERING,
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: BLACK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: BLACK },
          paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 }
        }
      },
      headers: { default: makeHeader('Note de Mise à Jour') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GÉNÉRATION
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const docs = [
    { name: 'CGV_TERRASOCIAL_Fev2026.docx',           doc: createCGV() },
    { name: 'Politique_Paiement_TERRASOCIAL_Fev2026.docx', doc: createPolitiquePaiement() },
    { name: 'Contrat_Reservation_TERRASOCIAL_Fev2026.docx', doc: createContratReservation() },
    { name: 'Note_MiseAJour_NouveauModele_Fev2026.docx',   doc: createNoteMiseAJour() },
  ];

  for (const { name, doc } of docs) {
    const buf = await Packer.toBuffer(doc);
    const dest = path.join(OUT_DIR, name);
    fs.writeFileSync(dest, buf);
    console.log(`✅ ${name} (${Math.round(buf.length / 1024)} Ko)`);
  }

  console.log('\n✅ Tous les documents Word ont été générés dans : ' + OUT_DIR);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
