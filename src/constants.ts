
import { PassportStandard, PaperFormat } from './types';

export const PHOTO_STANDARDS: PassportStandard[] = [
  // TOGO
  { id: 'tg-pass', country: 'Togo', category: 'standard', widthMm: 35, heightMm: 45, description: 'Passeport / CNI Togo' },
  { id: 'tg-diploma', country: 'Togo', category: 'diploma', widthMm: 40, heightMm: 40, description: 'Diplômes / Attestations (4x4)' },
  { id: 'tg-scol', country: 'Togo', category: 'badge', widthMm: 30, heightMm: 40, description: 'Carte Scolaire / Étudiant' },

  // FRANCE / EU
  { id: 'fr-eu', country: 'France / EU', category: 'standard', widthMm: 35, heightMm: 45, description: 'Standard Européen (ISO/IEC)' },

  // BENIN
  { id: 'bj-pass', country: 'Bénin', category: 'standard', widthMm: 35, heightMm: 45, description: 'Passeport Bénin' },

  // CÔTE D'IVOIRE
  { id: 'ci-pass', country: 'Côte d\'Ivoire', category: 'standard', widthMm: 35, heightMm: 45, description: 'Passeport / CNI CI' },

  // SENEGAL
  { id: 'sn-pass', country: 'Sénégal', category: 'standard', widthMm: 35, heightMm: 45, description: 'Passeport Sénégal' },

  // USA
  { id: 'us-visa', country: 'États-Unis', category: 'standard', widthMm: 51, heightMm: 51, description: 'Visa / Passport US (2x2")' },

  // AUTRES FORMATS GENERIQUES
  { id: 'gen-badge', country: 'Générique', category: 'badge', widthMm: 25, heightMm: 32, description: 'Petit format Badge' },
  { id: 'gen-diploma', country: 'Générique', category: 'diploma', widthMm: 45, heightMm: 50, description: 'Grand format Diplôme' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  standard: 'Passeport / Identité',
  diploma: 'Diplôme / Attestation',
  visa: 'Visa Spécifique',
  badge: 'Badge / Carte Pro',
};

export const PAPER_FORMATS: PaperFormat[] = [
  { id: '10x15', name: '10x15 cm (4x6")', widthMm: 100, heightMm: 150 },
  { id: 'A4', name: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'custom', name: 'Personnalisé', widthMm: 0, heightMm: 0 },
];
