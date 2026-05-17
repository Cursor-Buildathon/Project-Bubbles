import { type AffectTag } from './voiceTypes.js';

interface DetectAffectInput {
  text: string;
}

export function detectAffect(input: DetectAffectInput): AffectTag {
  const text = input.text.toLowerCase();

  if (/\b(urgent|asap|right now|immediately|before .* starts)\b/.test(text)) {
    return {
      primary: 'urgent',
      confidence: 0.82,
      urgency: 3,
      evidence: ['urgent-language'],
      ttsStyle: 'focused'
    };
  }

  if (/\b(frustrated|annoyed|upset|this is broken)\b/.test(text)) {
    return {
      primary: 'frustrated',
      confidence: 0.78,
      urgency: 2,
      evidence: ['frustration-language'],
      ttsStyle: 'calm'
    };
  }

  if (/\b(stuck|blocked|cannot move forward)\b/.test(text)) {
    return {
      primary: 'stuck',
      confidence: 0.76,
      urgency: 2,
      evidence: ['blocked-language'],
      ttsStyle: 'encouraging'
    };
  }

  if (/\b(confused|not sure|unclear|lost)\b/.test(text)) {
    return {
      primary: 'confused',
      confidence: 0.74,
      urgency: 1,
      evidence: ['uncertainty-language'],
      ttsStyle: 'encouraging'
    };
  }

  if (/\b(great|thanks|perfect|nice|done)\b/.test(text)) {
    return {
      primary: 'satisfied',
      confidence: 0.68,
      urgency: 0,
      evidence: ['positive-language'],
      ttsStyle: 'warm'
    };
  }

  return {
    primary: 'neutral',
    confidence: 0.6,
    urgency: 0,
    evidence: [],
    ttsStyle: 'warm'
  };
}
