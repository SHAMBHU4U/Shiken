#!/usr/bin/env node
/**
 * Seed 100 motivational quotes from world's greatest personalities
 * to Firebase Realtime Database at /quotes
 *
 * Run: FIREBASE_SERVICE_ACCOUNT=<json> node scripts/seed-quotes.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
initializeApp({
  credential: cert(SA),
  databaseURL: "https://shiken-d8789-default-rtdb.firebaseio.com",
});

const db = getDatabase();

// 5 visual themes cycling through 100 quotes
const THEMES = [
  { accent: "#a78bfa", grad: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(79,70,229,0.10))", border: "#7c3aed" },
  { accent: "#34d399", grad: "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.08))",  border: "#10b981" },
  { accent: "#fbbf24", grad: "linear-gradient(135deg,rgba(251,191,36,0.18),rgba(245,158,11,0.10))", border: "#f59e0b" },
  { accent: "#38bdf8", grad: "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(99,102,241,0.10))", border: "#0ea5e9" },
  { accent: "#f472b6", grad: "linear-gradient(135deg,rgba(244,114,182,0.15),rgba(167,139,250,0.10))",border: "#ec4899" },
];

const RAW_QUOTES = [
  // ── APJ Abdul Kalam ───────────────────────────────────────────────────────
  { hi: "सपने वो नहीं जो नींद में आएं — सपने वो हैं जो सोने न दें।", en: "Dream is not that which you see while sleeping; it is the thing that does not let you sleep.", emoji: "🌙", from: "— Dr. APJ Abdul Kalam" },
  { hi: "अगर तुम सूरज की तरह चमकना चाहते हो तो पहले सूरज की तरह जलना होगा।", en: "If you want to shine like a sun, first burn like a sun.", emoji: "☀️", from: "— Dr. APJ Abdul Kalam" },
  { hi: "इंसान को कठिनाइयों की ज़रूरत है — क्योंकि सफलता का आनंद उठाने के लिए ये ज़रूरी है।", en: "Man needs difficulties; they are necessary to enjoy success.", emoji: "💪", from: "— Dr. APJ Abdul Kalam" },
  { hi: "विज्ञान एक सुंदर उपहार है जो मनुष्य को दिया गया है; इसे बिगाड़ो मत।", en: "Science is a beautiful gift to humanity; we should not distort it.", emoji: "🔬", from: "— Dr. APJ Abdul Kalam" },
  // ── Swami Vivekananda ─────────────────────────────────────────────────────
  { hi: "उठो, जागो और तब तक मत रुको जब तक लक्ष्य न मिले।", en: "Arise, awake, and stop not till the goal is reached.", emoji: "🌅", from: "— Swami Vivekananda" },
  { hi: "खुद को कमज़ोर समझना सबसे बड़ा पाप है।", en: "The greatest sin is to think yourself weak.", emoji: "⚔️", from: "— Swami Vivekananda" },
  { hi: "एक विचार लो, उस विचार को अपनी ज़िंदगी बना लो — उसके बारे में सोचो, सपना देखो, उसे जियो।", en: "Take up one idea. Make that one idea your life — dream of it, live on that idea.", emoji: "💡", from: "— Swami Vivekananda" },
  { hi: "किसी की निंदा मत करो। अगर मदद कर सकते हो तो करो। नहीं कर सकते तो हाथ जोड़ो और जाओ।", en: "Never criticize anyone. If you can help, help. If not, fold your hands and move on.", emoji: "🙏", from: "— Swami Vivekananda" },
  // ── Mahatma Gandhi ────────────────────────────────────────────────────────
  { hi: "खुद वो बदलाव बनो जो तुम दुनिया में देखना चाहते हो।", en: "Be the change you wish to see in the world.", emoji: "🕊️", from: "— Mahatma Gandhi" },
  { hi: "भविष्य इस बात पर निर्भर करता है कि आज तुम क्या करते हो।", en: "The future depends on what you do today.", emoji: "📅", from: "— Mahatma Gandhi" },
  { hi: "पहले वो तुम्हें नज़रअंदाज़ करेंगे, फिर तुम पर हँसेंगे, फिर तुमसे लड़ेंगे — और तब तुम जीत जाओगे।", en: "First they ignore you, then they laugh at you, then they fight you, then you win.", emoji: "🏆", from: "— Mahatma Gandhi" },
  { hi: "जहाँ प्यार है वहाँ ज़िंदगी है।", en: "Where there is love there is life.", emoji: "❤️", from: "— Mahatma Gandhi" },
  // ── Albert Einstein ───────────────────────────────────────────────────────
  { hi: "कल्पना ज्ञान से ज़्यादा महत्वपूर्ण है।", en: "Imagination is more important than knowledge.", emoji: "🧠", from: "— Albert Einstein" },
  { hi: "जो व्यक्ति कभी गलती नहीं करता वो कभी नया नहीं करता।", en: "A person who never made a mistake never tried anything new.", emoji: "🔬", from: "— Albert Einstein" },
  { hi: "जिज्ञासा का अपना कारण होता है। कोई उसके सामने झुक नहीं सकता — जब हम अनंत जीवन, वास्तविकता और मौजूदा दुनिया के रहस्यों पर विचार करते हैं।", en: "The important thing is to not stop questioning. Curiosity has its own reason for existing.", emoji: "❓", from: "— Albert Einstein" },
  { hi: "जीवन साइकिल चलाने जैसा है — संतुलन बनाए रखने के लिए चलते रहना ज़रूरी है।", en: "Life is like riding a bicycle. To keep your balance you must keep moving.", emoji: "🚴", from: "— Albert Einstein" },
  // ── Steve Jobs ────────────────────────────────────────────────────────────
  { hi: "महान काम करने का एकमात्र तरीका यह है कि आप जो करते हैं उससे प्यार करें।", en: "The only way to do great work is to love what you do.", emoji: "❤️", from: "— Steve Jobs" },
  { hi: "रहो भूखे, रहो बेवकूफ।", en: "Stay hungry, stay foolish.", emoji: "🍎", from: "— Steve Jobs" },
  { hi: "नवाचार ही नेतृत्व और अनुसरण के बीच का फ़र्क है।", en: "Innovation distinguishes between a leader and a follower.", emoji: "🚀", from: "— Steve Jobs" },
  { hi: "आपका समय सीमित है — किसी और की ज़िंदगी जीने में उसे बर्बाद मत करो।", en: "Your time is limited, don't waste it living someone else's life.", emoji: "⏳", from: "— Steve Jobs" },
  // ── Nelson Mandela ────────────────────────────────────────────────────────
  { hi: "यह हमेशा असंभव लगता है जब तक यह हो न जाए।", en: "It always seems impossible until it's done.", emoji: "✅", from: "— Nelson Mandela" },
  { hi: "शिक्षा सबसे शक्तिशाली हथियार है जिसका उपयोग आप दुनिया को बदलने के लिए कर सकते हैं।", en: "Education is the most powerful weapon which you can use to change the world.", emoji: "📚", from: "— Nelson Mandela" },
  { hi: "मैं जीतने या हारने से नहीं, बल्कि कोशिश न करने से डरता हूँ।", en: "I learned that courage was not the absence of fear, but the triumph over it.", emoji: "🦁", from: "— Nelson Mandela" },
  // ── Abraham Lincoln ───────────────────────────────────────────────────────
  { hi: "सफलता की तैयारी करना ही सफलता है।", en: "Give me six hours to chop down a tree and I will spend the first four sharpening the axe.", emoji: "🪓", from: "— Abraham Lincoln" },
  { hi: "जो अपना दिमाग नहीं बदल सकता, वो कुछ भी नहीं बदल सकता।", en: "Those who deny freedom to others deserve it not for themselves.", emoji: "🗽", from: "— Abraham Lincoln" },
  { hi: "तुम सभी लोगों को कुछ समय के लिए और कुछ लोगों को हमेशा के लिए बेवकूफ बना सकते हो — लेकिन सभी लोगों को हमेशा नहीं।", en: "You can fool all people some of the time, and some people all the time, but not all the people all the time.", emoji: "🎭", from: "— Abraham Lincoln" },
  // ── Winston Churchill ─────────────────────────────────────────────────────
  { hi: "सफलता अंत नहीं है, असफलता घातक नहीं है — जारी रखने का साहस मायने रखता है।", en: "Success is not final, failure is not fatal — it is the courage to continue that counts.", emoji: "🔥", from: "— Winston Churchill" },
  { hi: "निराशावादी हर अवसर में कठिनाई देखता है; आशावादी हर कठिनाई में अवसर।", en: "A pessimist sees difficulty in every opportunity; an optimist sees opportunity in every difficulty.", emoji: "🌈", from: "— Winston Churchill" },
  // ── Warren Buffett ────────────────────────────────────────────────────────
  { hi: "किसी की तारीफ में ज़रा भी देर मत करो, और किसी की बुराई में ज़रा भी जल्दी।", en: "It takes 20 years to build a reputation and five minutes to ruin it.", emoji: "💎", from: "— Warren Buffett" },
  { hi: "आज किसी के साये में बैठो — किसी ने बहुत पहले पेड़ लगाया था।", en: "Someone's sitting in the shade today because someone planted a tree a long time ago.", emoji: "🌳", from: "— Warren Buffett" },
  // ── Elon Musk ─────────────────────────────────────────────────────────────
  { hi: "जब कुछ काफी महत्वपूर्ण हो तो करो — भले ही odds तुम्हारे खिलाफ हों।", en: "When something is important enough, you do it even if the odds are not in your favor.", emoji: "🚀", from: "— Elon Musk" },
  { hi: "Failure is an option here. If things are not failing, you are not innovating enough.", en: "असफलता यहाँ एक विकल्प है। अगर चीजें विफल नहीं हो रही हैं, तो आप पर्याप्त नवाचार नहीं कर रहे।", emoji: "⚡", from: "— Elon Musk" },
  // ── Bill Gates ────────────────────────────────────────────────────────────
  { hi: "सफलता एक घटिया शिक्षक है। यह लोगों को यह सोचने पर मजबूर करती है कि वो हार नहीं सकते।", en: "Success is a lousy teacher. It seduces smart people into thinking they can't lose.", emoji: "💻", from: "— Bill Gates" },
  { hi: "हम हमेशा अगले दो साल में होने वाले बदलावों को overestimate करते हैं और अगले दस साल में होने वाले को underestimate।", en: "We overestimate the change in the next 2 years and underestimate the change in the next 10.", emoji: "📊", from: "— Bill Gates" },
  // ── Oprah Winfrey ─────────────────────────────────────────────────────────
  { hi: "भाग्य तैयारी और अवसर का मिलन है।", en: "Luck is a matter of preparation meeting opportunity.", emoji: "🍀", from: "— Oprah Winfrey" },
  { hi: "जब तुम अपनी आवाज़ खो दो, तुम अपना रास्ता खो देते हो।", en: "The biggest adventure you can ever take is to live the life of your dreams.", emoji: "🌟", from: "— Oprah Winfrey" },
  // ── Marie Curie ───────────────────────────────────────────────────────────
  { hi: "जीवन में किसी भी बात से डरना नहीं चाहिए — बस समझना चाहिए।", en: "Nothing in life is to be feared, it is only to be understood.", emoji: "⚗️", from: "— Marie Curie" },
  { hi: "आपको यह विश्वास करना होगा कि आप कुछ ऐसा कर सकते हैं जिसे करना दूसरे असंभव समझते हैं।", en: "You must believe in yourself and in your capacity for doing something that others believe impossible.", emoji: "🔭", from: "— Marie Curie" },
  // ── Thomas Edison ─────────────────────────────────────────────────────────
  { hi: "प्रतिभा 1% प्रेरणा और 99% पसीना है।", en: "Genius is one percent inspiration and ninety-nine percent perspiration.", emoji: "💡", from: "— Thomas Edison" },
  { hi: "मैं हज़ार बार असफल नहीं हुआ — मैंने एक हज़ार ऐसे तरीके खोजे जो काम नहीं करते।", en: "I have not failed. I've just found 10,000 ways that won't work.", emoji: "🔦", from: "— Thomas Edison" },
  // ── Stephen Hawking ───────────────────────────────────────────────────────
  { hi: "हालात चाहे जैसे भी हों — जहाँ जीवन है वहाँ उम्मीद है।", en: "However difficult life may seem, there is always something you can do and succeed at.", emoji: "🌌", from: "— Stephen Hawking" },
  { hi: "बुद्धि बदलाव को अपनाने की क्षमता है।", en: "Intelligence is the ability to adapt to change.", emoji: "🧬", from: "— Stephen Hawking" },
  // ── Nikola Tesla ──────────────────────────────────────────────────────────
  { hi: "आज के वैज्ञानिक भौतिक शक्ति से नहीं, ब्रह्मांड के रहस्यों की खोज से प्रेरित होते हैं।", en: "The scientists of today think deeply instead of clearly. One must be sane to think clearly, but one can think deeply and be quite insane.", emoji: "⚡", from: "— Nikola Tesla" },
  // ── Isaac Newton ──────────────────────────────────────────────────────────
  { hi: "अगर मैं दूर तक देख पाया हूँ तो यह इसलिए क्योंकि मैं दिग्गजों के कंधों पर खड़ा था।", en: "If I have seen further, it is by standing on the shoulders of giants.", emoji: "🍎", from: "— Isaac Newton" },
  // ── Confucius ─────────────────────────────────────────────────────────────
  { hi: "वो काम चुनो जो तुम्हें पसंद हो और तुम्हें अपनी ज़िंदगी में एक भी दिन काम नहीं करना पड़ेगा।", en: "Choose a job you love and you will never have to work a day in your life.", emoji: "🎋", from: "— Confucius" },
  { hi: "जो सुनता है वो जानता है; जो देखता है वो समझता है; जो करता है वो सीखता है।", en: "I hear and I forget. I see and I remember. I do and I understand.", emoji: "📜", from: "— Confucius" },
  // ── Aristotle ─────────────────────────────────────────────────────────────
  { hi: "हम वो हैं जो हम बार-बार करते हैं। उत्कृष्टता इसलिए एक कार्य नहीं, एक आदत है।", en: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", emoji: "🏺", from: "— Aristotle" },
  { hi: "शिक्षित मन की पहचान यह है कि वो किसी विचार को बिना स्वीकार किए भी मनोरंजक रूप में विचार कर सके।", en: "It is the mark of an educated mind to be able to entertain a thought without accepting it.", emoji: "🦉", from: "— Aristotle" },
  // ── Leonardo da Vinci ─────────────────────────────────────────────────────
  { hi: "सरलता परम परिष्कार है।", en: "Simplicity is the ultimate sophistication.", emoji: "🎨", from: "— Leonardo da Vinci" },
  { hi: "ज्ञान प्राप्त करने में की गई देरी ज़िंदगी को बर्बाद कर देती है।", en: "Learning never exhausts the mind.", emoji: "🖌️", from: "— Leonardo da Vinci" },
  // ── Napoleon Bonaparte ────────────────────────────────────────────────────
  { hi: "Impossible शब्द मूर्खों की शब्दावली में पाया जाता है।", en: "The word 'impossible' is not in my dictionary.", emoji: "⚔️", from: "— Napoleon Bonaparte" },
  // ── Socrates ──────────────────────────────────────────────────────────────
  { hi: "जो जानता है वो जानता है कि वो नहीं जानता — यही असली ज्ञान है।", en: "The only true wisdom is in knowing you know nothing.", emoji: "🏛️", from: "— Socrates" },
  // ── Mark Twain ────────────────────────────────────────────────────────────
  { hi: "20 साल बाद तुम उन चीज़ों से ज़्यादा निराश होगे जो तुमने नहीं कीं, बजाय उनके जो तुमने कीं।", en: "Twenty years from now you will be more disappointed by the things you didn't do than the ones you did.", emoji: "⛵", from: "— Mark Twain" },
  { hi: "सफलता का रहस्य — जब तुम जो करना चाहते हो उसे करने का तरीका खोज लो।", en: "The secret of getting ahead is getting started.", emoji: "🏁", from: "— Mark Twain" },
  // ── Charles Darwin ────────────────────────────────────────────────────────
  { hi: "जो प्रजाति जीवित रहती है वो सबसे शक्तिशाली नहीं — बल्कि वो है जो बदलाव के साथ सबसे आसानी से अनुकूलित हो जाती है।", en: "It is not the strongest of the species that survives, nor the most intelligent; it is the one most adaptable to change.", emoji: "🦋", from: "— Charles Darwin" },
  // ── Walt Disney ───────────────────────────────────────────────────────────
  { hi: "सभी सपने सच हो सकते हैं, अगर हम उन्हें पूरा करने का साहस रखें।", en: "All our dreams can come true, if we have the courage to pursue them.", emoji: "🏰", from: "— Walt Disney" },
  { hi: "यह मज़ेदार है कि जीवन में आगे बढ़ने के लिए पहले पीछे मुड़कर देखना पड़ता है।", en: "The way to get started is to quit talking and begin doing.", emoji: "🎬", from: "— Walt Disney" },
  // ── Henry Ford ────────────────────────────────────────────────────────────
  { hi: "अगर तुम सोचते हो कि तुम कर सकते हो — या तुम नहीं कर सकते — दोनों ही सही हैं।", en: "Whether you think you can, or you think you can't — you're right.", emoji: "🚗", from: "— Henry Ford" },
  { hi: "विफलता बस शुरू करने का अवसर है — इस बार और समझदारी से।", en: "Failure is simply the opportunity to begin again, this time more intelligently.", emoji: "🔧", from: "— Henry Ford" },
  // ── Benjamin Franklin ─────────────────────────────────────────────────────
  { hi: "जो अच्छा करने की परवाह करता है, वो ज़रूर अच्छा करेगा।", en: "An investment in knowledge pays the best interest.", emoji: "📜", from: "— Benjamin Franklin" },
  { hi: "बताओ मत मुझे, दिखाओ मुझे।", en: "Well done is better than well said.", emoji: "🦅", from: "— Benjamin Franklin" },
  // ── Ratan Tata ────────────────────────────────────────────────────────────
  { hi: "अगर तुम एक सितारा बनना चाहते हो, तो पहले एक ठोस नींव बनानी होगी।", en: "I don't believe in taking the right decisions — I take decisions and then make them right.", emoji: "🏗️", from: "— Ratan Tata" },
  { hi: "मुझे गलत साबित करो — मुझे सफलता दिखाने का यही सबसे अच्छा तरीका है।", en: "Ups and downs in life are very important to keep us going, because a straight line even in an ECG means we are not alive.", emoji: "📈", from: "— Ratan Tata" },
  // ── Dhirubhai Ambani ──────────────────────────────────────────────────────
  { hi: "बड़ा सोचो, जल्दी सोचो, आगे सोचो। विचार किसी की बपौती नहीं।", en: "Think big, think fast, think ahead. Ideas are no one's monopoly.", emoji: "💼", from: "— Dhirubhai Ambani" },
  // ── Narendra Modi ─────────────────────────────────────────────────────────
  { hi: "भारत के युवा ही देश का भविष्य हैं।", en: "The youth of India are the future of the nation.", emoji: "🇮🇳", from: "— Narendra Modi" },
  // ── Mother Teresa ─────────────────────────────────────────────────────────
  { hi: "अगर तुम सौ लोगों को नहीं खिला सकते, तो एक को तो खिलाओ।", en: "If you can't feed a hundred people, then feed just one.", emoji: "🕊️", from: "— Mother Teresa" },
  { hi: "कल गया, कल आएगा — आज में जीयो।", en: "Yesterday is gone. Tomorrow has not yet come. We have only today.", emoji: "🌸", from: "— Mother Teresa" },
  // ── Rabindranath Tagore ───────────────────────────────────────────────────
  { hi: "फूल को खोने का डर लगाए रखो मत — वरना इसे खिलने भी नहीं दोगे।", en: "Don't limit a child to your own learning, for they were born in another time.", emoji: "🌺", from: "— Rabindranath Tagore" },
  // ── Chanakya ──────────────────────────────────────────────────────────────
  { hi: "शिक्षा सबसे अच्छी मित्र है। शिक्षित व्यक्ति हर जगह सम्मान पाता है।", en: "Education is the best friend. An educated person is respected everywhere.", emoji: "📖", from: "— Chanakya" },
  { hi: "जब तक तुम्हारा लक्ष्य पूरा न हो, नींद को सोने मत दो।", en: "Before you start some work, always ask yourself three questions.", emoji: "🎯", from: "— Chanakya" },
  // ── Dalai Lama ────────────────────────────────────────────────────────────
  { hi: "खुशी एक तैयार माल नहीं है — यह तुम्हारे अपने कार्यों से आती है।", en: "Happiness is not something ready-made. It comes from your own actions.", emoji: "☮️", from: "— Dalai Lama" },
  { hi: "अगर तुम दूसरों की मदद नहीं कर सकते, तो कम से कम उन्हें नुकसान मत पहुँचाओ।", en: "If you can't help others, at least don't hurt them.", emoji: "🌏", from: "— Dalai Lama" },
  // ── Barack Obama ──────────────────────────────────────────────────────────
  { hi: "बदलाव कभी आसान नहीं होता — लेकिन हमेशा संभव होता है।", en: "Change will not come if we wait for some other person or some other time.", emoji: "🗣️", from: "— Barack Obama" },
  // ── Maya Angelou ──────────────────────────────────────────────────────────
  { hi: "लोग भूल जाएंगे तुमने क्या कहा, तुमने क्या किया — लेकिन कभी नहीं भूलेंगे कि तुमने उन्हें कैसा महसूस कराया।", en: "People will forget what you said, forget what you did, but never forget how you made them feel.", emoji: "🌟", from: "— Maya Angelou" },
  // ── Paulo Coelho ──────────────────────────────────────────────────────────
  { hi: "जब तुम कुछ चाहते हो, तो पूरी कायनात तुम्हें उसे पाने में मदद करती है।", en: "When you want something, all the universe conspires in helping you to achieve it.", emoji: "✨", from: "— Paulo Coelho" },
  // ── Rumi ──────────────────────────────────────────────────────────────────
  { hi: "तुम वो नहीं जो तुम्हें लगता है तुम हो — तुम वो हो जो तुम तलाश करते हो।", en: "You are not a drop in the ocean. You are the entire ocean in a drop.", emoji: "🌊", from: "— Rumi" },
  { hi: "जो तुम तलाश रहे हो, वो भी तुम्हें तलाश रहा है।", en: "What you seek is seeking you.", emoji: "🔮", from: "— Rumi" },
  // ── Bruce Lee ─────────────────────────────────────────────────────────────
  { hi: "पानी की तरह बनो — बाधा को मत मानो, उसके इर्द-गिर्द जाओ।", en: "Be like water making its way through cracks.", emoji: "🥋", from: "— Bruce Lee" },
  { hi: "अगर तुम हमेशा एक ही सीमा में रहोगे, चाहे वो काम में हो या मार्शल आर्ट में — वो तुम्हारे जीवन में फैल जाएगी।", en: "If you always put limits on everything you do, it will spread into your work, into your life.", emoji: "🥊", from: "— Bruce Lee" },
  // ── Nikola Tesla (extra) ──────────────────────────────────────────────────
  { hi: "भविष्य मेरा है।", en: "The present is theirs; the future, for which I really worked, is mine.", emoji: "⚡", from: "— Nikola Tesla" },
  // ── Marcus Aurelius ───────────────────────────────────────────────────────
  { hi: "तुम्हारे पास वो शक्ति है जो तुम्हें जीवन को रोज़ नए सिरे से शुरू करने देती है।", en: "You have power over your mind — not outside events. Realize this and you will find strength.", emoji: "🏛️", from: "— Marcus Aurelius" },
  { hi: "बाधाओं को दूर करने का प्रयास करें — यह वही काम बन जाएगा।", en: "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity.", emoji: "🗿", from: "— Marcus Aurelius" },
  // ── Lao Tzu ───────────────────────────────────────────────────────────────
  { hi: "हज़ारों मील की यात्रा एक कदम से शुरू होती है।", en: "A journey of a thousand miles begins with a single step.", emoji: "👣", from: "— Lao Tzu" },
  { hi: "जब तुम खुद को जानते हो, तुम ज्ञान पाते हो; जब तुम खुद को जीतते हो, तुम सच्ची शक्ति पाते हो।", en: "Knowing others is wisdom; knowing yourself is enlightenment.", emoji: "☯️", from: "— Lao Tzu" },
  // ── Richard Branson ───────────────────────────────────────────────────────
  { hi: "अवसर व्यापार में नहीं होते — वे लोगों में होते हैं।", en: "Business opportunities are like buses — there's always another one coming.", emoji: "🚌", from: "— Richard Branson" },
  // ── J.K. Rowling ──────────────────────────────────────────────────────────
  { hi: "असंभव वो होता है जो किसी ने अभी तक नहीं किया।", en: "It is impossible to live without failing at something, unless you live so cautiously that you might as well not have lived at all.", emoji: "⚡", from: "— J.K. Rowling" },
  // ── Michael Jordan ────────────────────────────────────────────────────────
  { hi: "मैं अपने career में 9000 से ज़्यादा shots miss कर चुका हूँ — यही मेरी सफलता का राज़ है।", en: "I've missed more than 9,000 shots in my career. That's why I succeed.", emoji: "🏀", from: "— Michael Jordan" },
  // ── Kobe Bryant ───────────────────────────────────────────────────────────
  { hi: "महान सोच छोटे काम से शुरू होती है।", en: "The most important thing is to try and inspire people so that they can be great in whatever they want to do.", emoji: "🏆", from: "— Kobe Bryant" },
  // ── Sundar Pichai ─────────────────────────────────────────────────────────
  { hi: "आपकी सफलता का सबसे बड़ा कारण आपकी खुद पर आस्था है।", en: "Let yourself be led by passion. It's ultimately what will keep you moving.", emoji: "🔍", from: "— Sundar Pichai" },
  // ── Satya Nadella ─────────────────────────────────────────────────────────
  { hi: "हम सब lifelong learners हैं — हर दिन कुछ नया सीखने का मौका है।", en: "Our industry does not respect tradition — it only respects innovation.", emoji: "💻", from: "— Satya Nadella" },
  // ── Extra universal ───────────────────────────────────────────────────────
  { hi: "जो पढ़ता है वो आगे बढ़ता है — जो नहीं पढ़ता वो पीछे रहता है।", en: "Reading is to the mind what exercise is to the body.", emoji: "📚", from: "— Joseph Addison" },
  { hi: "असफलता सफलता का हिस्सा है — इसे accept करना सीखो।", en: "Success is stumbling from failure to failure with no loss of enthusiasm.", emoji: "🎯", from: "— Winston Churchill" },
  { hi: "ज़िंदगी में कोई shortcut नहीं होती — मेहनत ही रास्ता है।", en: "There are no shortcuts to any place worth going.", emoji: "🛤️", from: "— Beverly Sills" },
  { hi: "बड़े सपने देखो, छोटे शुरुआत करो, जल्दी सीखो।", en: "Dream big, start small, learn fast.", emoji: "🌠", from: "" },
  { hi: "अंधेरे से डरो मत — तारे अंधेरे में ही चमकते हैं।", en: "Stars can't shine without darkness.", emoji: "⭐", from: "" },
];

// Assign theme and index to each quote
const quotes = RAW_QUOTES.map((q, i) => ({
  id: i,
  ...q,
  from: q.from ?? "",
  ...THEMES[i % THEMES.length],
}));

async function seed() {
  console.log(`Pushing ${quotes.length} quotes to Firebase at /quotes ...`);
  const ref = db.ref("quotes");
  await ref.set(quotes);
  console.log(`✅ Done! ${quotes.length} quotes seeded at /quotes`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
