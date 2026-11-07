#!/usr/bin/env python3
"""Records the village's voices with ElevenLabs and writes js/tour/voicelines.js.

Dadi (the guide) speaks every stop in Hindi and in English; villagers, children, shopkeepers and the
pujari each have their own voice for short lines.

By default this only rebuilds js/tour/voicelines.js from the clips already in assets/voice and never
calls ElevenLabs. Recording new clips spends ElevenLabs credits, so it needs the explicit flag:

    python3 tools/make-voices.py                   # list the existing clips, no credits used
    python3 tools/make-voices.py --spend-credits   # record missing lines (needs ELEVENLABS_API_KEY)
"""
import json, os, re, sys, urllib.request, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "voice")
KEY = os.environ.get("ELEVENLABS_API_KEY")

VOICES = {
    "dadi": "NU0iY2ULYR4TzJYPOm31",     # Manoj Kumari: mature, warm
    "kid": "Pbk8E6dlpCANrnpOLIns",      # Mishi: a child's voice
    "woman": "p4mOWN9BnkdoXBcTftPD",    # Devika: lively
    "man": "H9oourY5nVeVuzarh4D5",      # Neeraj: warm and friendly
    "shopman": "GlVAIcqCDwBCWaztXn36",  # Kamal: confident, a seller's patter
    "shopwoman": "hHyd5z9VxRT4YKoDwPRl",  # Lalita: funny, relatable
    "priest": "ovcrTRBELQPup0RNagdO",   # Pranit: soothing, devotional
}

# the guide's Hindi lines live in guide.js; read them from there so there is one source
src = open(os.path.join(ROOT, "js", "tour", "guide.js"), encoding="utf-8").read()
blk = src[src.index("export const HI = {"):]
blk = blk[: blk.index("};")]
GUIDE_HI = {m.group(1): m.group(2) for m in re.finditer(r'^\s*"?([a-z:]+)"?:\s*"([^"]+)",?\s*$', blk, re.M)}

GUIDE_EN = {
    "gali": "Come, child. It's Amavasya, the darkest night of the year. There's no moon, yet look how the whole lane glows. Every single diya was lit by someone's hand.",
    "kuan": "This is our well. Water is life, so tonight even its rim gets diyas, the way we welcome a guest.",
    "gaushala": "The cows have been bathed and dressed up, horns painted, bells round their necks. Tomorrow is Govardhan Puja.",
    "mehmaan": "On Diwali the neighbours visit each other. A box of sweets, a cup of chai, and so much to talk about. Have one more ladoo!",
    "rasoi": "On the verandah the puris are puffing up in hot oil and the kheer is cooking. We'll all eat together after the puja.",
    "aangan": "Your mother made this rangoli, with Lakshmi ji's footprints leading to the door. You light the first diya, by the tulsi.",
    "puja": "Now it's time for Lakshmi Puja. First Ganesh ji's aarti, then Lakshmi ji's. Go on, you can hold the thali too.",
    "kumhar": "Our potter works the wheel all month. Every diya in the village came from his kiln.",
    "mela": "The fair has a giant wheel, toys and balloons. Tonight the children are in heaven.",
    "haat": "Under the old banyan the market is set up. Murtis, diyas, bangles, khil batashe and crackers. Don't forget to bargain!",
    "taash": "Playing cards on Diwali night is a tradition. They say whoever wins tonight keeps Lakshmi ji at home all year.",
    "mandir": "At the village temple the pujari is doing the aarti. Ring the bell, and light your home's diya from the temple flame.",
    "pokhar": "At the pond, diyas float away on leaf boats for our ancestors. In the water, every diya becomes two.",
    "bazaar": "The market street is the busiest place tonight. Groceries, utensils, saris, sweets. Every shop is open.",
    "chhat": "From the rooftop you can see the whole village, and the lights of the villages far away. Shubh Deepavali to everyone.",
    "dhanteras:aangan": "Today is Dhanteras. A new thali, a brass lota and a silver coin have come home from the market. At the door, the four-wicked Yam deepak burns for everyone's long life.",
    "dhanteras:bazaar": "On Dhanteras there's a queue at the utensil shop. Something new in metal must come home today, even if it's just a spoon.",
    "choti:aangan": "Today is Choti Diwali. Everyone bathed with ubtan before sunrise. Now a fresh rangoli is being drawn, and fourteen diyas wait on the wall.",
    "govardhan:gaushala": "Today is Govardhan Puja. Krishna lifted the Govardhan hill to shelter the village, so we shape it from cow dung, walk around it with our thalis, and offer the annakoot.",
    "bhaidooj:aangan": "Today is Bhai Dooj. The sister puts a tilak of roli and rice on her brother's forehead, does his aarti and feeds him a sweet. He has brought her a gift.",
}

# short lines; the key prefix picks the voice, the text is also shown in the speech bubble
LINES = {
    # Dadi
    "dadi_welcome": ("dadi", "स्वागत है बेटा, हमारे गाँव की दिवाली में!"),
    "dadi_bless_1": ("dadi", "जीते रहो बेटा, सदा खुश रहो।"),
    "dadi_bless_2": ("dadi", "इस साल तुम्हारे घर खूब खुशियाँ आएँ, लक्ष्मी जी का वास हो।"),
    "dadi_bless_3": ("dadi", "जो चाहो, वो मिले। बस मेहनत करते रहना।"),
    "dadi_bless_4": ("dadi", "तुम्हारे घर का हर दीया हमेशा जलता रहे।"),
    "dadi_bless_5": ("dadi", "अपनों के साथ रहो, यही असली दिवाली है।"),
    "dadi_bless_6": ("dadi", "मिठाई खाओ, मिठास बाँटो। शुभ दीपावली!"),
    "dadi_home": ("dadi", "वाह! पूरा घर जगमगा गया। लक्ष्मी जी ज़रूर आएँगी।"),
    "dadi_aarti": ("dadi", "बहुत सुंदर आरती की, बेटा! भगवान भला करें।"),
    # family
    "fam_maa": ("woman", "बेटा, आरती का समय हो गया!"),
    "fam_papa": ("man", "आ गए! मिठाई लाए?"),
    "fam_didi": ("kid", "भैया, फुलझड़ी जलाएँ?"),
    "fam_bhai": ("man", "दीदी, ये रहा तुम्हारा तोहफ़ा!"),
    "fam_behen": ("woman", "आओ, टीका लगा दूँ!"),
    # children
    "kid_1": ("kid", "हैप्पी दिवाली!"),
    "kid_2": ("kid", "पटाखे! पटाखे!"),
    "kid_3": ("kid", "देखो देखो, रॉकेट!"),
    "kid_4": ("kid", "वाह! कितना सुंदर!"),
    "kid_5": ("kid", "एक और! एक और!"),
    "kid_6": ("kid", "मेरी फुलझड़ी देखो!"),
    # women
    "woman_1": ("woman", "शुभ दीपावली!"),
    "woman_2": ("woman", "आइए, मिठाई खाइए!"),
    "woman_3": ("woman", "अरे वाह, कितने सुंदर दीये लगाए हैं!"),
    "woman_4": ("woman", "लक्ष्मी जी आपके घर आएँ!"),
    # men
    "man_1": ("man", "शुभ दीपावली भैया!"),
    "man_2": ("man", "राम राम जी!"),
    "man_3": ("man", "आइए, बैठिए, चाय पीजिए!"),
    "man_4": ("man", "दिवाली मुबारक हो!"),
    # elders
    "elder_1": ("dadi", "जीते रहो!"),
    "elder_2": ("dadi", "हमारे ज़माने में भी ऐसी ही रौनक होती थी।"),
    # shopkeepers
    "shop_m_1": ("shopman", "आइए आइए, सबसे सस्ता माल!"),
    "shop_m_2": ("shopman", "दिवाली का माल, ले जाइए!"),
    "shop_m_3": ("shopman", "चलो, आपके लिए कम कर देते हैं।"),
    "shop_m_4": ("shopman", "इससे कम नहीं होगा भैया!"),
    "shop_w_1": ("shopwoman", "आइए दीदी, सब ताज़ा है!"),
    "shop_w_2": ("shopwoman", "देख लीजिए, देखने के पैसे नहीं!"),
    "shop_w_3": ("shopwoman", "ठीक है, दिवाली है, ले जाइए।"),
    "shop_w_4": ("shopwoman", "ना ना, घाटे में नहीं बेचेंगे!"),
    # the pujari
    "priest_1": ("priest", "ॐ जय लक्ष्मी माता!"),
    "priest_2": ("priest", "घंटी बजाइए, प्रसाद लीजिए।"),
}


def tts(voice, text, lang, path):
    body = json.dumps({"text": text, "model_id": "eleven_v4", "language_code": lang,
                       "voice_settings": {"stability": 0.45, "similarity_boost": 0.8}}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[voice]}?output_format=mp3_44100_64",
        data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())


def main():
    record = "--spend-credits" in sys.argv
    if record and not KEY:
        sys.exit("Set ELEVENLABS_API_KEY first.")
    jobs = []
    for k, t in GUIDE_HI.items():
        jobs.append((f"guide-hi-{k.replace(':', '-')}", "dadi", t, "hi"))
    for k, t in GUIDE_EN.items():
        jobs.append((f"guide-en-{k.replace(':', '-')}", "dadi", t, "en"))
    for k, (v, t) in LINES.items():
        jobs.append((k, v, t, "hi"))
    os.makedirs(OUT, exist_ok=True)
    chars = 0
    for name, voice, text, lang in jobs:
        # the file name carries a hash of the text, so changing a line records it again
        h = hashlib.sha1(f"{voice}|{lang}|{text}".encode()).hexdigest()[:6]
        path = os.path.join(OUT, f"{name}.{h}.mp3")
        if os.path.exists(path) or not record:
            continue
        for old in os.listdir(OUT):
            if old.startswith(name + "."):
                os.remove(os.path.join(OUT, old))
        tts(voice, text, lang, path)
        chars += len(text)
        print(f"recorded {name} ({len(text)} chars)")
    # the page's map: key -> file and text
    files = {f.split(".")[0]: f for f in os.listdir(OUT) if f.endswith(".mp3")}
    lines = {k: {"file": files.get(k), "text": t, "voice": v} for k, (v, t) in LINES.items()}
    guide = {lang: {k: files.get(f"guide-{lang}-{k.replace(':', '-')}") for k in src_} for lang, src_ in (("hi", GUIDE_HI), ("en", GUIDE_EN))}
    js = "// Generated by tools/make-voices.py: recorded voices for the guide and the villagers.\n"
    js += "export const GUIDE_AUDIO = " + json.dumps(guide, ensure_ascii=False, indent=1) + ";\n"
    js += "export const VOICE_LINES = " + json.dumps(lines, ensure_ascii=False, indent=1) + ";\n"
    open(os.path.join(ROOT, "js", "tour", "voicelines.js"), "w", encoding="utf-8").write(js)
    print(f"done: {chars} characters recorded this run")


if __name__ == "__main__":
    main()
