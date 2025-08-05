import { blacklist } from "./profanityList.js";

const blacklistSet = new Set(blacklist.map(word => word.toLowerCase()));

const leetMap = {
  '@': 'a', '4': 'a',
  '8': 'b',
  '(': 'c',
  '3': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't'
};

function normalize(word) {
  let lowered = word.toLowerCase();
  lowered = lowered.replace(/[.@48()31!|05$7]/g, c => leetMap[c] || c);
  return lowered.replace(/[^a-z]/g, '');
}

export function isProfane(text) {
  return text
    .split(/\s+/)
    .some(word => blacklistSet.has(normalize(word)));
}

export function clean(text) {
  return text
    .split(/\s+/)
    .map(word => {
      const normalized = normalize(word);
      return blacklistSet.has(normalized) ? '*'.repeat(word.length) : word;
    })
    .join(' ');
}