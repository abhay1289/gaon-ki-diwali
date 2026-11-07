// A spoken guide, like a grandparent walking you through the village: a few lines at every stop,
// in Hindi or English, read by the browser's own speech voices. Nothing is downloaded.

export const HI = {
  gali: "आओ बेटा, आज अमावस की रात है। चाँद नहीं निकला, फिर भी देखो, पूरी गली दीयों से जगमगा रही है। हर दीया किसी ने अपने हाथ से जलाया है।",
  kuan: "ये हमारा कुआँ है। पानी ही जीवन है, इसलिए आज इसकी मुंडेर पर भी दीये रखे हैं, जैसे किसी मेहमान का स्वागत करते हैं।",
  gaushala: "गौशाला में गायों को नहला कर सजाया है, सींगों पर रंग, गले में घुँघरू। कल गोवर्धन पूजा है, गोबर से गोवर्धन बनेगा।",
  mehmaan: "दिवाली पर पड़ोसी एक दूसरे के घर जाते हैं। मिठाई का डिब्बा, चाय, और ढेर सारी बातें। अरे, एक लड्डू और लो!",
  rasoi: "बरामदे की रसोई में पूरियाँ तल रही हैं, खीर पक रही है। पूजा के बाद सब मिलकर खाएँगे।",
  aangan: "आँगन में अम्मा ने रंगोली बनाई है, और देहरी तक लक्ष्मी जी के पैरों के निशान। तुलसी का पहला दीया तुम जलाओ।",
  puja: "अब लक्ष्मी पूजन का समय है। पहले गणेश जी की आरती, फिर माँ लक्ष्मी जी की। चाहो तो थाली तुम भी घुमाओ।",
  kumhar: "कुम्हार काका पूरे महीने चाक पर दीये बनाते हैं। गाँव के सारे दीये यहीं से आते हैं, भट्टी में पके हुए।",
  mela: "मेले में झूला है, खिलौने हैं, गुब्बारे हैं। बच्चों की तो आज मौज है।",
  haat: "बरगद के नीचे हाट लगी है। मूर्तियाँ, दीये, चूड़ियाँ, खील बताशे, और पटाखे। मोल भाव करना मत भूलना।",
  taash: "दिवाली की रात ताश खेलने का रिवाज़ है। कहते हैं, आज जो जीतता है, साल भर लक्ष्मी उसके घर रहती है।",
  mandir: "गाँव के मंदिर में पुजारी जी आरती कर रहे हैं। घंटी बजाओ, और यहाँ की ज्योति से अपने घर का दीया जलाओ।",
  pokhar: "पोखर के घाट पर पत्तों की नाव में दीये बहाए जाते हैं, पुरखों के लिए। पानी में हर दीया दो हो जाता है।",
  bazaar: "बाज़ार में आज सबसे ज़्यादा भीड़ है। किराना, बर्तन, कपड़े, मिठाई, खील बताशे। सब दुकानें खुली हैं।",
  chhat: "छत से पूरा गाँव दिखता है, और दूर के गाँवों की रोशनी भी। सबको शुभ दीपावली।",
  // the other days
  "dhanteras:aangan": "आज धनतेरस है। बाज़ार से नई थाली, पीतल का लोटा और चाँदी का सिक्का आया है। दरवाज़े पर दक्षिण की ओर यम का चौमुखा दीया जला है, घर के सबकी लंबी उम्र के लिए।",
  "dhanteras:bazaar": "धनतेरस पर बर्तन की दुकान पर लाइन लगी है। आज कुछ न कुछ नया धातु का घर आना ही चाहिए, चाहे एक चम्मच ही क्यों न हो।",
  "choti:aangan": "आज छोटी दिवाली है, रूप चौदस। सुबह सुबह उबटन लगाकर नहाए हैं। अब नई रंगोली बन रही है, और दीवार पर चौदह दीये रखे हैं।",
  "govardhan:gaushala": "आज गोवर्धन पूजा है। कृष्ण जी ने गोवर्धन पर्वत उठाकर गाँव को बारिश से बचाया था। इसलिए गोबर से गोवर्धन बना है, औरतें थाली लेकर परिक्रमा कर रही हैं, और अन्नकूट का भोग लगा है।",
  "bhaidooj:aangan": "आज भाई दूज है। बहन भाई के माथे पर रोली चावल का टीका लगा रही है, आरती उतार रही है, मिठाई खिला रही है। भाई बहन के लिए तोहफ़ा लाया है।",
};

export class Guide {
  // recorded(lang, key) returns a recorded clip for a stop if there is one; the browser voice is the fallback
  constructor({ onSpeak, recorded } = {}) {
    this.recorded = recorded;
    this.clip = new Audio();
    this.mode = "off"; // off | hi | en
    this.onSpeak = onSpeak;
    this.ok = "speechSynthesis" in window;
    try { this.mode = localStorage.getItem("guide") || "off"; } catch (_) { /* storage blocked */ }
    if (!this.ok && !this.recorded) this.mode = "off";
    this.voices = [];
    const load = () => (this.voices = speechSynthesis.getVoices());
    if (this.ok) { load(); speechSynthesis.addEventListener?.("voiceschanged", load); }
  }

  // off → हिन्दी → English → off
  cycle() {
    this.mode = { off: "hi", hi: "en", en: "off" }[this.mode];
    try { localStorage.setItem("guide", this.mode); } catch (_) { /* fine */ }
    if (this.mode === "off") this.stop();
    return this.mode;
  }

  voice(lang) {
    const v = this.voices;
    return v.find((x) => x.lang === lang) || v.find((x) => x.lang.startsWith(lang.slice(0, 2))) || null;
  }

  hasHindi() { return !!this.voice("hi-IN"); }

  stop() {
    clearTimeout(this.t);
    this.clip.pause();
    if (this.ok) speechSynthesis.cancel();
    this.onSpeak?.(false);
  }

  // read this stop: the grandmother's Hindi, or the English text from the panel
  say(stop) {
    if (this.mode === "off") return;
    this.stop();
    // Dadi's own recorded voice, when this stop has one
    const url = this.recorded?.(this.mode, stop.id);
    if (url) {
      this.clip.src = url;
      this.clip.onplay = () => this.onSpeak?.(true);
      this.clip.onended = this.clip.onerror = () => this.onSpeak?.(false);
      this.t = setTimeout(() => this.clip.play().catch(() => this.onSpeak?.(false)), 700);
      return;
    }
    if (!this.ok) return;
    const hindi = this.mode === "hi" && HI[stop.id];
    // the first time it speaks, the guide greets you by name
    const hello = this.name && !this.greeted ? (hindi ? `${this.name} जी, ` : `${this.name}, `) : "";
    this.greeted = true;
    const u = new SpeechSynthesisUtterance(hello + (hindi || `${stop.en}. ${stop.text}`));
    u.lang = hindi ? "hi-IN" : "en-IN";
    u.voice = this.voice(u.lang) || this.voice(hindi ? "hi" : "en-GB");
    u.rate = hindi ? 0.92 : 0.95;
    u.pitch = 1;
    u.onstart = () => this.onSpeak?.(true);
    u.onend = u.onerror = () => this.onSpeak?.(false);
    // a short pause after arriving, so the view settles first
    clearTimeout(this.t);
    this.t = setTimeout(() => speechSynthesis.speak(u), 700);
  }
}
