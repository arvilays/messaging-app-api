const adjectives = [
  'Ancient', 'Arcane', 'Atomic', 'Binary', 'Blaze', 'Bold', 'Brave',
  'Bright', 'Calm', 'Clever', 'Cosmic', 'Crimson', 'Cyber', 'Digital',
  'Dire', 'Eager', 'Emerald', 'Fable', 'Fierce', 'Frost', 'Gentle',
  'Glitch', 'Golden', 'Grand', 'Grim', 'Happy', 'Hexa', 'Hydro',
  'Iron', 'Jolly', 'Keen', 'Kind', 'Lively', 'Logic', 'Lucky',
  'Lunar', 'Mythic', 'Nano', 'Nice', 'Noble', 'Proud', 'Quantum',
  'Quick', 'Robo', 'Ruby', 'Shadow', 'Silent', 'Silly', 'Solar',
  'Static', 'Steel', 'Stone', 'Storm', 'Stout', 'Sunny', 'Swift',
  'Terra', 'Vector', 'Virtual', 'Vivid', 'Wise', 'Witty'
];

const nouns = [
  'Array', 'Bear', 'Bird', 'Blade', 'Bot', 'Byte', 'Cat',
  'Circuit', 'Claw', 'Core', 'Crown', 'Dog', 'Dragon', 'Droid',
  'Eagle', 'Echo', 'Fang', 'Fish', 'Fox', 'Frame', 'Ghost',
  'Giant', 'Golem', 'Gryphon', 'Guard', 'Hawk', 'Heart', 'Helm',
  'Jaguar', 'Jolt', 'Knight', 'Leopard', 'Lion', 'Mage', 'Matrix',
  'Node', 'Panda', 'Panther', 'Pilot', 'Pixel', 'Pulse', 'Puma',
  'Ranger', 'Relay', 'Rider', 'Rover', 'Sage', 'Scout', 'Scribe',
  'Shark', 'Shield', 'Shift', 'Spear', 'Spirit', 'Sprite', 'Thorn',
  'Tiger', 'Unit', 'Warden', 'Wizard', 'Wolf', 'Wraith'
];

export function generateRandomUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${adj}${noun}${number}`;
}

export function generateRandomPassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';

  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

const greetings = [
  "Hello from",
  "Hey, it's",
  "Greetings from",
  "Hi there, this is",
  "What's up from",
  "Good day from",
  "Hey there, it's",
  "Warm wishes from",
  "Cheers from",
  "Hi from",
  "Yo, it's",
  "Howdy from",
  "Salutations from",
  "Hey hey from",
  "Much love from",
  "Big hugs from",
  "Smiles from",
  "Good vibes from",
  "Kind regards from",
  "Hello hello from",
  "Warm regards from",
  "Best wishes from",
  "Sending greetings from",
  "High fives from",
  "Peace from",
  "Good morning from",
  "Good evening from",
  "Hey all, it's",
  "A wave from",
  "Friendly hello from",
  "Quick hi from",
  "Hey folks, it's",
  "A hello from",
  "A warm hello from",
  "Hey everyone, it's",
];

export const getRandomGreeting = () => greetings[Math.floor(Math.random() * greetings.length)];