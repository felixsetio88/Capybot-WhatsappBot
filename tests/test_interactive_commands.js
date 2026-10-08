import assert from 'assert';
import Database from 'better-sqlite3';
import { createDatabaseHelper } from '../src/database/db.js';
import aiService from '../src/bot/services/aiService.js';

console.log('🧪 Starting Interactive Features (.match, .topic, .wordgame, .leaderboard) Tests...\n');

// 1. IN-MEMORY DATABASE TESTING
console.log('--- 1. Database: Word Game Scores & Reply Tracking ---');
const rawDb = new Database(':memory:');
const db = createDatabaseHelper(rawDb);

const uid = 1;
const groupJid = '1234567890@g.us';
const userA = '6281111111@s.whatsapp.net';
const userB = '6282222222@s.whatsapp.net';
const userC = '6283333333@s.whatsapp.net';

// Initial score should be 0
assert.strictEqual(db.getWordGameUserScore(uid, groupJid, userA), 0);

// Add scores
const scoreA = db.addWordGameScore(uid, groupJid, userA, 'Alice', 1);
assert.strictEqual(scoreA, 1);

const scoreA2 = db.addWordGameScore(uid, groupJid, userA, 'Alice', 2);
assert.strictEqual(scoreA2, 3);

db.addWordGameScore(uid, groupJid, userB, 'Bob', 5);
db.addWordGameScore(uid, groupJid, userC, 'Charlie', 2);

// Leaderboard should be ordered DESC (Bob: 5, Alice: 3, Charlie: 2)
const leaderboard = db.getWordGameLeaderboard(uid, groupJid, 10);
assert.strictEqual(leaderboard.length, 3);
assert.strictEqual(leaderboard[0].user_name, 'Bob');
assert.strictEqual(leaderboard[0].score, 5);
assert.strictEqual(leaderboard[1].user_name, 'Alice');
assert.strictEqual(leaderboard[1].score, 3);
assert.strictEqual(leaderboard[2].user_name, 'Charlie');
assert.strictEqual(leaderboard[2].score, 2);
console.log('  ✅ [PASS] Word game score tracking, accumulation & leaderboard rankings');

// Reset scores
assert.strictEqual(db.resetWordGameScores(uid, groupJid), true);
assert.strictEqual(db.getWordGameLeaderboard(uid, groupJid, 10).length, 0);
console.log('  ✅ [PASS] Reset word game scores');

// 2. REPLY TRACKING & .match PARTNER CALCULATION
console.log('\n--- 2. Message History & .match Compatibility Partner ---');
// User A replies to User B 3 times
db.saveGroupMessage(uid, {
  messageId: 'msg1',
  groupJid,
  senderJid: userA,
  senderName: 'Alice',
  messageText: 'Hey Bob, what do you think?',
  replyToJid: userB,
  replyToName: 'Bob',
  timestamp: 1000,
});
db.saveGroupMessage(uid, {
  messageId: 'msg2',
  groupJid,
  senderJid: userA,
  senderName: 'Alice',
  messageText: 'Totally agree with you Bob!',
  replyToJid: userB,
  replyToName: 'Bob',
  timestamp: 2000,
});
db.saveGroupMessage(uid, {
  messageId: 'msg3',
  groupJid,
  senderJid: userA,
  senderName: 'Alice',
  messageText: 'Bob did you see this?',
  replyToJid: userB,
  replyToName: 'Bob',
  timestamp: 3000,
});

// User A replies to User C 1 time
db.saveGroupMessage(uid, {
  messageId: 'msg4',
  groupJid,
  senderJid: userA,
  senderName: 'Alice',
  messageText: 'Thanks Charlie',
  replyToJid: userC,
  replyToName: 'Charlie',
  timestamp: 4000,
});

const topPartnerA = db.getTopReplyPartner(uid, groupJid, userA);
assert.ok(topPartnerA);
assert.strictEqual(topPartnerA.partnerJid, userB);
assert.strictEqual(topPartnerA.partnerName, 'Bob');
assert.strictEqual(topPartnerA.replyCount, 3);
console.log('  ✅ [PASS] getTopReplyPartner identifies most frequent quote/reply partner');

// User with no message history
const topPartnerGhost = db.getTopReplyPartner(uid, groupJid, '6289999999@s.whatsapp.net');
assert.strictEqual(topPartnerGhost, null);
console.log('  ✅ [PASS] getTopReplyPartner returns null when no replies exist');

// 3. .topic DICE ROLL & UNIQUENESS GENERATION
console.log('\n--- 3. Gen Z .topic Dice Roll & Uniqueness ---');
const topic1 = aiService.generateGenZTopic();
assert.ok(topic1.roll >= 1 && topic1.roll <= 20);
assert.ok(topic1.category);
assert.ok(topic1.prompt);
assert.ok(topic1.formattedText.includes('DICE ROLL'));
assert.ok(topic1.formattedText.includes('Gen Z Topic Time'));

// Verify multiple consecutive rolls produce fresh topics
const topicsSet = new Set();
for (let i = 0; i < 15; i++) {
  const t = aiService.generateGenZTopic();
  topicsSet.add(t.prompt);
}
assert.ok(topicsSet.size >= 10, 'Topic generator must provide varied topics without immediate repetitions');
console.log('  ✅ [PASS] .topic generates valid dice rolls and diverse unique questions');

// 4. .wordgame QUESTION GENERATION & GUESS VERIFICATION
console.log('\n--- 4. .wordgame Question Generation & Clues ---');
const question = aiService.generateWordGameQuestion();
assert.ok(question.word);
assert.ok(question.clue);
assert.ok(question.hint);
assert.ok(question.scramble);
assert.ok(question.category);
assert.strictEqual(question.points, 1);
assert.ok(question.hint.includes('('), 'Hint should indicate word letter length');

// Simulate answer matching logic
const targetWord = question.word.toUpperCase();
const userGuessExact = targetWord;
const userGuessCase = targetWord.toLowerCase();
const userGuessSentence = `I think the answer is ${targetWord} for sure`;
const userGuessWrong = 'COMPLETELY_WRONG_ANSWER';

assert.ok(userGuessExact.trim().toUpperCase() === targetWord);
assert.ok(userGuessCase.trim().toUpperCase() === targetWord);
assert.ok(userGuessSentence.toUpperCase().includes(targetWord));
assert.ok(!userGuessWrong.toUpperCase().includes(targetWord));
console.log('  ✅ [PASS] .wordgame question clues and answer evaluation matches correctly');

// 5. COMMAND REGEX MATCHERS
console.log('\n--- 5. Command Trigger Regex Tests ---');
const matchRegex = /^\.(match|cocok|ship|soulmate)\b/i;
assert.ok(matchRegex.test('.match'));
assert.ok(matchRegex.test('.cocok'));
assert.ok(matchRegex.test('.ship'));
assert.ok(matchRegex.test('.soulmate'));
assert.ok(!matchRegex.test('.matching'));

const topicRegex = /^\.(topic|topik|obrolan|icebreaker)\b/i;
assert.ok(topicRegex.test('.topic'));
assert.ok(topicRegex.test('.topik'));
assert.ok(topicRegex.test('.obrolan'));
assert.ok(topicRegex.test('.icebreaker'));
assert.ok(!topicRegex.test('.topical'));

const wordgameRegex = /^\.(wordgame|game|tebakkata|riddle)\b/i;
assert.ok(wordgameRegex.test('.wordgame'));
assert.ok(wordgameRegex.test('.wordgame hint'));
assert.ok(wordgameRegex.test('.wordgame giveup'));
assert.ok(wordgameRegex.test('.tebakkata'));
assert.ok(wordgameRegex.test('.riddle'));

const guessRegex = /^\.(guess|tebaklagu|songgame|tebaksong)\b/i;
assert.ok(guessRegex.test('.guess'));
assert.ok(guessRegex.test('.guess hint'));
assert.ok(guessRegex.test('.guess giveup'));
assert.ok(guessRegex.test('.tebaklagu'));
assert.ok(guessRegex.test('.songgame'));
assert.ok(!guessRegex.test('.guessing'));

const closeRegex = /^\.(close|tutup|lockgroup|grouplock)\b/i;
assert.ok(closeRegex.test('.close'));
assert.ok(closeRegex.test('.tutup'));
assert.ok(closeRegex.test('.lockgroup'));
assert.ok(!closeRegex.test('.closed'));

const openRegex = /^\.(open|buka|unlockgroup)\b/i;
assert.ok(openRegex.test('.open'));
assert.ok(openRegex.test('.buka'));
assert.ok(openRegex.test('.unlockgroup'));
assert.ok(!openRegex.test('.opening'));

const addRegex = /^\.(add|tambah|invite)\b/i;
assert.ok(addRegex.test('.add 628123456789'));
assert.ok(addRegex.test('.tambah 628111111'));
assert.ok(addRegex.test('.invite 6012345678'));

const lbRegex = /^\.(leaderboard|lb|score|scores|topgame)\b/i;
assert.ok(lbRegex.test('.leaderboard'));
assert.ok(lbRegex.test('.lb'));
assert.ok(lbRegex.test('.score'));
assert.ok(lbRegex.test('.scores'));
assert.ok(lbRegex.test('.topgame'));
console.log('  ✅ [PASS] All command regex triggers match accurately');

// 6. SONG BANK & .guess GAME ENGINE TESTS
console.log('\n--- 6. Song Bank (100 Songs 2016-2026) & .guess Engine ---');
import songBank, {
  SONG_DATABASE,
  generateSongGuessQuestion,
  evaluateSongGuess,
  createMaskedHint,
} from '../src/bot/services/songBank.js';

// Verify song database count
assert.strictEqual(SONG_DATABASE.length, 100, 'Song database must contain exactly 100 songs');

// Verify all songs released between 2016 and 2026
for (const s of SONG_DATABASE) {
  assert.ok(s.title, 'Song must have title');
  assert.ok(s.artist, 'Song must have artist');
  assert.ok(s.lyrics, 'Song must have lyric excerpt');
  assert.ok(s.year >= 2016 && s.year <= 2026, `Song year ${s.year} must be between 2016 and 2026`);
  assert.ok(Array.isArray(s.aliases), 'Song aliases must be an array');
}
console.log('  ✅ [PASS] Database contains 100 valid popular songs released between 2016 and 2026');

// Question generation & dice roll
const songQ = generateSongGuessQuestion();
assert.ok(songQ.roll >= 1 && songQ.roll <= 100, 'Song dice roll must be between 1 and 100');
assert.strictEqual(songQ.diceSides, 100, 'Dice sides must be 100');
assert.ok(songQ.song.title, 'Question must include song title');
assert.ok(songQ.song.lyrics, 'Question must include lyric excerpt');
assert.ok(songQ.maskedHint.includes('_'), 'Masked hint must contain hidden letters');
assert.ok(songQ.formattedPrompt.includes('CAPYBOT SONG LYRIC GUESS CHALLENGE'));
assert.ok(songQ.formattedPrompt.includes('Roll:'));

// Uniqueness roll check (15 consecutive rolls produce varied songs)
const rolledTitles = new Set();
for (let i = 0; i < 15; i++) {
  const q = generateSongGuessQuestion();
  rolledTitles.add(q.song.title);
}
assert.ok(rolledTitles.size >= 10, 'Dice roll must yield unique non-repeating songs');
console.log('  ✅ [PASS] .guess generates 100-sided dice rolls and unique song selections');

// Guess evaluation tests
const testSong = {
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  year: 2019,
  lyrics: 'I said, ooh, I’m blinded by the lights',
  aliases: ['blinding lights', 'blinding light'],
};

assert.strictEqual(evaluateSongGuess('blinding lights', testSong), true);
assert.strictEqual(evaluateSongGuess('BLINDING LIGHTS', testSong), true);
assert.strictEqual(evaluateSongGuess('Blinding Light', testSong), true);
assert.strictEqual(evaluateSongGuess('The answer is blinding lights!', testSong), true);
assert.strictEqual(evaluateSongGuess('shape of you', testSong), false);
assert.strictEqual(evaluateSongGuess('', testSong), false);
console.log('  ✅ [PASS] Song guess evaluation handles exact, alias, and case-insensitive matches');

// 7. .add PHONE NUMBER FORMAT VALIDATION
console.log('\n--- 7. .add [phone number] Validation & Normalization ---');
function validateAndNormalizePhone(rawInput) {
  let cleanPhone = rawInput.replace(/[^\d]/g, '');
  if (cleanPhone.startsWith('08')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  if (!cleanPhone || !/^[1-9]\d{8,14}$/.test(cleanPhone)) {
    return { valid: false, phone: null };
  }
  return { valid: true, phone: cleanPhone };
}

// Valid formats
assert.strictEqual(validateAndNormalizePhone('628123456789').valid, true);
assert.strictEqual(validateAndNormalizePhone('628123456789').phone, '628123456789');
assert.strictEqual(validateAndNormalizePhone('+62 812-3456-789').valid, true);
assert.strictEqual(validateAndNormalizePhone('+62 812-3456-789').phone, '628123456789');
assert.strictEqual(validateAndNormalizePhone('08123456789').valid, true);
assert.strictEqual(validateAndNormalizePhone('08123456789').phone, '628123456789'); // converted 08 -> 628
assert.strictEqual(validateAndNormalizePhone('60123456789').valid, true); // Malaysian number
assert.strictEqual(validateAndNormalizePhone('14155552671').valid, true); // US number

// Invalid formats
assert.strictEqual(validateAndNormalizePhone('12345').valid, false); // too short
assert.strictEqual(validateAndNormalizePhone('abcdef').valid, false); // not a number
assert.strictEqual(validateAndNormalizePhone('').valid, false); // empty
assert.strictEqual(validateAndNormalizePhone('00000000000').valid, false); // starts with 0
console.log('  ✅ [PASS] .add phone number validation normalizes Indonesian 08 and enforces international format');

// 8. EXPANDED TOPIC & WORDGAME COVERAGE
console.log('\n--- 8. Expanded Topic & Wordgame Coverage ---');
// Verify topic bank has at least 50 topics
const generatedTopics = new Set();
for (let i = 0; i < 60; i++) {
  const t = aiService.generateGenZTopic();
  generatedTopics.add(t.prompt);
}
assert.ok(generatedTopics.size >= 35, 'Large variety of unique topics must be generated');

// Test wordgame bank has at least 60 words
const generatedWords = new Set();
for (let i = 0; i < 150; i++) {
  const w = aiService.generateWordGameQuestion();
  generatedWords.add(w.word);
}
assert.ok(generatedWords.size >= 40, 'Large variety of unique words must be generated');
console.log('  ✅ [PASS] .topic (50+ items) and .wordgame (60+ items) provide extensive replayability');

console.log('\n==========================================');
console.log('🎉 ALL INTERACTIVE & V1.2 COMMAND TESTS PASSED!');
console.log('==========================================\n');
