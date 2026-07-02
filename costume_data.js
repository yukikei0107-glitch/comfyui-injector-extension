// 衣装ガチャ用の厳選タグプール（danbooru風）。
// COSTUME_SLOTS: パーツの並びとラベル。COSTUME_THEMES: テーマ別の各パーツ候補。
// 空文字 "" はそのパーツ「なし」を表す（アウター・頭・アクセは無い方が自然なことも多い）。
window.COSTUME_SLOTS = [
  { key: "main",       label: "メイン" },
  { key: "legwear",    label: "レッグ" },
  { key: "shoes",      label: "靴" },
  { key: "outerwear",  label: "アウター" },
  { key: "head",       label: "頭" },
  { key: "accessory",  label: "アクセ" }
];

window.COSTUME_THEMES = {
  omakase: { label: "🎲 おまかせ", random: true },

  seifuku: {
    label: "制服",
    slots: {
      main: [
        "serafuku, pleated skirt",
        "long-sleeve serafuku, pleated skirt",
        "summer serafuku, short sleeves, pleated skirt",
        "blazer, dress shirt, ribbon, pleated skirt",
        "blazer, cardigan, necktie, pleated skirt",
        "sailor dress, white collar",
        "sweater vest, dress shirt, pleated skirt"
      ],
      legwear: ["black thighhighs", "white thighhighs", "black pantyhose", "loose socks", "white kneehighs", "black kneehighs, zettai ryouiki"],
      shoes: ["loafers", "brown loafers", "uwabaki", "sneakers"],
      outerwear: ["", "", "school cardigan", "duffle coat", "jacket over shoulders"],
      head: ["", "hair ribbon", "hairclip", "hair bow"],
      accessory: ["", "", "school bag", "necktie", "name tag"]
    }
  },

  casual: {
    label: "カジュアル",
    slots: {
      main: [
        "t-shirt, denim shorts",
        "hoodie, pleated skirt",
        "oversized sweater, thighhighs",
        "off-shoulder sweater, skirt",
        "crop top, high-waist jeans",
        "blouse, suspender skirt",
        "turtleneck sweater, corduroy skirt",
        "graphic tee, cargo pants",
        "camisole, cardigan, shorts"
      ],
      legwear: ["", "", "black thighhighs", "white socks", "over-knee socks", "ankle socks"],
      shoes: ["sneakers", "white sneakers", "canvas shoes", "ankle boots", "sandals"],
      outerwear: ["", "", "denim jacket", "bomber jacket", "oversized cardigan", "plaid shirt around waist"],
      head: ["", "", "beanie", "baseball cap", "hair clip"],
      accessory: ["", "", "shoulder bag", "backpack", "choker", "earrings"]
    }
  },

  mizugi: {
    label: "水着",
    slots: {
      main: [
        "white bikini", "black bikini", "string bikini", "frilled bikini",
        "polka dot bikini", "halterneck bikini", "one-piece swimsuit",
        "competition swimsuit", "sailor-collar swimsuit", "sling bikini"
      ],
      legwear: ["", "", ""],
      shoes: ["barefoot", "flip-flops", "sandals", "beach sandals"],
      outerwear: ["", "", "sheer pareo", "open beach jacket", "unbuttoned shirt"],
      head: ["", "sun hat", "sunglasses on head", "flower hair ornament"],
      accessory: ["", "", "swim ring", "beach ball", "sunglasses", "anklet"]
    }
  },

  wasou: {
    label: "和装",
    slots: {
      main: [
        "kimono, obi", "yukata, obi", "floral kimono, wide obi",
        "furisode, elaborate obi", "hakama, kimono", "red kimono, gold obi"
      ],
      legwear: ["tabi socks", "tabi socks", ""],
      shoes: ["geta", "zori", "okobo"],
      outerwear: ["", "", "haori", "shawl"],
      head: ["", "kanzashi", "flower hair ornament", "hair stick"],
      accessory: ["", "", "folding fan", "paper umbrella", "drawstring bag"]
    }
  },

  fantasy: {
    label: "ファンタジー",
    slots: {
      main: [
        "fantasy dress, corset", "leather armor, tunic", "mage robe, hood",
        "knight armor, breastplate", "witch dress", "priestess robe",
        "adventurer outfit, tunic, belt", "elf dress, cape", "ornate battle dress"
      ],
      legwear: ["thighhighs", "armored leggings", "black thighhighs, garter", ""],
      shoes: ["knee-high boots", "armored boots", "leather boots", "thigh boots"],
      outerwear: ["", "flowing cape", "hooded cloak", "fur-trimmed mantle"],
      head: ["", "circlet", "witch hat", "tiara", "hood"],
      accessory: ["", "staff", "sword at hip", "spellbook", "amulet"]
    }
  },

  heyagi: {
    label: "部屋着",
    slots: {
      main: [
        "oversized t-shirt", "camisole, short shorts", "pajamas",
        "hoodie, boyshorts", "long nightgown", "sweatshirt, sweatpants",
        "tank top, sleep shorts", "fluffy loungewear"
      ],
      legwear: ["", "", "loose socks", "knee socks", "fuzzy socks"],
      shoes: ["barefoot", "slippers", "bunny slippers"],
      outerwear: ["", "", "open cardigan", "blanket over shoulders", "fluffy robe"],
      head: ["", "messy hair", "hair bun", "sleep mask on forehead"],
      accessory: ["", "", "holding pillow", "holding mug", "stuffed animal"]
    }
  },

  dress: {
    label: "ドレス",
    slots: {
      main: [
        "evening gown", "cocktail dress", "black dress", "red evening dress",
        "off-shoulder gown", "lace dress", "ball gown", "elegant white dress",
        "sequined dress"
      ],
      legwear: ["sheer black pantyhose", "", "white thighhighs"],
      shoes: ["high heels", "stiletto heels", "strappy heels", "ankle-strap heels"],
      outerwear: ["", "", "shawl", "fur stole", "elegant gloves"],
      head: ["", "tiara", "hair flower", "elegant updo"],
      accessory: ["", "pearl necklace", "drop earrings", "clutch bag", "long gloves"]
    }
  },

  gothic: {
    label: "ゴシック/ロリータ",
    slots: {
      main: [
        "gothic lolita dress", "black and red lolita dress", "frilled gothic dress",
        "sweet lolita dress, pastel", "victorian dress, lace", "corset dress, ruffles"
      ],
      legwear: ["black thighhighs, lace trim", "white lace stockings", "striped tights"],
      shoes: ["mary janes", "platform boots", "buckle shoes", "rocking horse shoes"],
      outerwear: ["", "", "bolero", "capelet"],
      head: ["frilled headband", "bonnet", "mini top hat", "lace headdress"],
      accessory: ["", "parasol", "choker", "lace gloves"]
    }
  },

  sports: {
    label: "スポーツ",
    slots: {
      main: [
        "sports bra, shorts", "tank top, track shorts", "gym uniform, buruma",
        "tennis outfit", "track jacket, track pants", "leotard",
        "volleyball uniform", "yoga outfit, leggings", "cycling jersey, bike shorts"
      ],
      legwear: ["athletic socks", "knee-high socks", ""],
      shoes: ["sneakers", "running shoes", "tennis shoes", "high-top sneakers"],
      outerwear: ["", "", "track jacket", "windbreaker"],
      head: ["", "headband", "visor", "sports cap", "ponytail"],
      accessory: ["", "", "sweatband", "water bottle", "towel around neck"]
    }
  }
};
