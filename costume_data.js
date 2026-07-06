// 衣装ガチャ用の厳選タグプール（danbooru風）。
// COSTUME_SLOTS: パーツの並びとラベル。COSTUME_THEMES: テーマ別の各パーツ候補。
// 空文字 "" はそのパーツ「なし」を表す（アウター・頭・アクセは無い方が自然なことも多い）。
window.COSTUME_SLOTS = [
  { key: "main",       label: "メイン" },
  { key: "legwear",    label: "レッグ" },
  { key: "shoes",      label: "靴" },
  { key: "outerwear",  label: "アウター" },
  { key: "head",       label: "頭" },
  { key: "accessory",  label: "アクセ" },
  { key: "color",      label: "色" }
];

// 色（全体の配色）候補。テーマ共通で使う。"" は色指定なし。
window.COSTUME_COLORS = [
  "", "", "monochrome", "pastel colors", "vivid colors", "dark theme",
  "black theme", "white theme", "red theme", "pink theme", "blue theme",
  "purple theme", "green theme", "yellow theme", "orange theme", "brown theme",
  "black and white", "red and black", "white and gold", "blue and white",
  "pink and white", "limited palette", "colorful"
];

// 過去プロンプトから「服の部分だけ」を抽出するためのキーワード（スロット別）。
// タグにこれらの語が含まれていたら、そのスロットの衣装タグとみなす。
// 判定は legwear→shoes→outerwear→head→accessory→main の順（具体的な物を先に）。
window.COSTUME_KEYWORDS = {
  legwear: ["thighhighs", "thigh-highs", "pantyhose", "tights", "kneehighs", "knee-highs", "stockings", "socks", "legwear", "zettai ryouiki", "garter", "leg warmers", "leggings"],
  shoes: ["shoes", "boots", "sneakers", "heels", "loafers", "sandals", "geta", "zori", "okobo", "mary janes", "flip-flops", "barefoot", "slippers", "uwabaki", "footwear", "pumps", "mules"],
  outerwear: ["jacket", "coat", "cloak", "cape", "mantle", "haori", "bolero", "capelet", "windbreaker", "poncho", "parka", "overcoat", "trenchcoat", "shawl", "stole"],
  head: ["hat", "cap", "beanie", "headband", "hairband", "ribbon", "hairclip", "hair clip", "hair bow", "hair ornament", "hair flower", "tiara", "circlet", "bonnet", "hood", "visor", "kanzashi", "headdress", "beret", "crown", "hairpin"],
  accessory: ["gloves", "choker", "necklace", "earrings", "backpack", "bag", "scarf", "sunglasses", "glasses", "belt", "staff", "sword", "parasol", "folding fan", "umbrella", "anklet", "bracelet", "amulet", "necktie", "bowtie", "pendant", "brooch", "wristband", "armband", "collar", "pouch", "purse", "clutch", "spellbook", "water bottle", "sweatband", "swim ring", "beach ball", "name tag"],
  main: ["shirt", "blouse", "t-shirt", "tshirt", "tee", "sweater", "hoodie", "cardigan", "sweatshirt", "tank", "camisole", "crop", "dress", "gown", "skirt", "shorts", "pants", "jeans", "trousers", "overalls", "serafuku", "uniform", "blazer", "sailor", "kimono", "yukata", "furisode", "hakama", "leotard", "bikini", "swimsuit", "one-piece", "swimwear", "robe", "nightgown", "pajamas", "negligee", "lolita", "armor", "breastplate", "tunic", "corset", "apron", "maid", "bodysuit", "jumpsuit", "buruma", "bloomers", "vest", "jersey", "sleepwear", "loungewear", "outfit"]
};

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
        "sweater vest, dress shirt, pleated skirt",
        "winter serafuku, long sleeves, pleated skirt",
        "blazer, sweater, plaid skirt",
        "sailor dress, long skirt", "gakuran-style uniform, skirt"
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
        "camisole, cardigan, shorts",
        "off-shoulder top, wide pants", "knit dress",
        "parka, mini skirt", "shirt dress", "overalls, striped shirt"
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
        "competition swimsuit", "sailor-collar swimsuit", "sling bikini",
        "micro bikini", "tankini", "bikini, sarong", "front-tie bikini", "high-leg swimsuit"
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
  },

  maid: {
    label: "メイド",
    slots: {
      main: [
        "maid outfit", "maid dress, apron", "victorian maid dress",
        "black maid dress, white apron", "frilled maid dress", "short maid dress",
        "long maid dress, puffy sleeves", "gothic maid dress"
      ],
      legwear: ["black thighhighs", "white thighhighs", "black pantyhose", "white stockings, lace trim"],
      shoes: ["mary janes", "black heels", "buckle shoes"],
      outerwear: ["", "", "shawl"],
      head: ["maid headdress", "frilled hairband", "white headdress", "maid headdress, ribbon"],
      accessory: ["", "wrist cuffs", "feather duster", "serving tray", "black choker", "apron"]
    }
  },

  nurse: {
    label: "ナース",
    slots: {
      main: [
        "nurse uniform", "white nurse dress", "pink nurse uniform",
        "short nurse dress", "nurse dress, front zipper", "sleeveless nurse dress"
      ],
      legwear: ["white thighhighs", "white pantyhose", "white kneehighs", ""],
      shoes: ["white nurse shoes", "white sneakers", "white heels"],
      outerwear: ["", "", "white coat", "cardigan"],
      head: ["nurse cap", "nurse cap, red cross", ""],
      accessory: ["", "stethoscope", "syringe", "clipboard", "wrist watch"]
    }
  },

  miko: {
    label: "巫女",
    slots: {
      main: [
        "miko outfit", "white kimono, red hakama", "miko, red hakama",
        "detached sleeves, red hakama", "white kosode, red nagabakama"
      ],
      legwear: ["tabi socks", "tabi socks", "", "white thighhighs"],
      shoes: ["zori", "geta", "sandals"],
      outerwear: ["", "haori", "chihaya"],
      head: ["", "hair ribbon", "white ribbon", "flower hair ornament"],
      accessory: ["", "ofuda", "gohei", "folding fan", "kagura bell"]
    }
  },

  china: {
    label: "チャイナ服",
    slots: {
      main: [
        "china dress", "red china dress", "blue china dress, gold trim",
        "short china dress", "china dress, thigh slit", "cheongsam",
        "sleeveless china dress", "floral china dress"
      ],
      legwear: ["black thighhighs", "china dress, pelvic curtain", "white thighhighs", ""],
      shoes: ["heels", "flats", "mary janes"],
      outerwear: ["", ""],
      head: ["double bun", "hair buns", "flower hair ornament", ""],
      accessory: ["", "chinese knot", "folding fan", "gold bracelet", "hair stick"]
    }
  },

  office: {
    label: "OL・オフィス",
    slots: {
      main: [
        "business suit, pencil skirt", "office lady, blouse, skirt",
        "blazer, dress shirt, pencil skirt", "suit, tight skirt",
        "vest, dress shirt, skirt", "blouse, high-waist skirt"
      ],
      legwear: ["sheer black pantyhose", "black pantyhose", "black thighhighs", ""],
      shoes: ["high heels", "black heels", "pumps"],
      outerwear: ["", "", "blazer", "suit jacket", "trench coat"],
      head: ["", "", "glasses", "hair bun", "ponytail"],
      accessory: ["", "glasses", "necktie", "id card", "handbag", "wristwatch"]
    }
  },

  idol: {
    label: "アイドル",
    slots: {
      main: [
        "idol costume", "frilly idol dress", "sparkly idol outfit",
        "idol dress, ruffles", "pop idol costume, layered skirt",
        "frilled idol dress, ribbons"
      ],
      legwear: ["white thighhighs", "striped thighhighs", "frilled thighhighs", "over-knee socks"],
      shoes: ["knee-high boots", "mary janes", "white boots", "platform shoes"],
      outerwear: ["", "short cape", "detached sleeves"],
      head: ["hair bow", "tiara", "large hair bow", "star hair ornament", "headset"],
      accessory: ["", "frilled gloves", "microphone", "wrist cuffs", "star accessory"]
    }
  },

  bunny: {
    label: "バニー",
    slots: {
      main: [
        "playboy bunny", "bunny suit", "black leotard, bunny",
        "white bunny suit", "strapless leotard, bunny", "red bunny suit"
      ],
      legwear: ["black pantyhose", "fishnet pantyhose", "sheer pantyhose"],
      shoes: ["high heels", "stiletto heels"],
      outerwear: ["", ""],
      head: ["rabbit ears", "fake animal ears", "bunny ears, headband"],
      accessory: ["wrist cuffs", "bowtie", "detached collar", "rabbit tail"]
    }
  },

  wedding: {
    label: "ウェディング",
    slots: {
      main: [
        "wedding dress", "white wedding dress", "strapless wedding dress",
        "lace wedding dress", "ball gown wedding dress", "mermaid wedding dress"
      ],
      legwear: ["white thighhighs", "", "white stockings, lace trim"],
      shoes: ["white heels", "white high heels", "strappy heels"],
      outerwear: ["", "shawl", "bridal cape"],
      head: ["bridal veil", "veil", "tiara", "flower crown", "white flower hair ornament"],
      accessory: ["", "bouquet", "pearl necklace", "long white gloves"]
    }
  },

  magical: {
    label: "魔法少女",
    slots: {
      main: [
        "magical girl", "magical girl outfit, frills", "magical girl dress, layered skirt",
        "sailor-style magical girl outfit", "frilly magical girl costume"
      ],
      legwear: ["white thighhighs", "striped thighhighs", "over-knee socks", "frilled thighhighs"],
      shoes: ["knee-high boots", "mary janes", "white boots", "ribbon-laced boots"],
      outerwear: ["", "short cape", "flowing ribbon", "detached sleeves"],
      head: ["tiara", "hair bow", "large ribbon", "circlet", "magical girl hair ornament"],
      accessory: ["magic wand", "frilled gloves", "brooch", "star accessory"]
    }
  },

  military: {
    label: "軍服",
    slots: {
      main: [
        "military uniform", "military uniform, skirt", "officer uniform",
        "camouflage uniform", "military jacket, shorts", "combat uniform"
      ],
      legwear: ["black thighhighs", "", "black pantyhose", "knee-high socks"],
      shoes: ["combat boots", "military boots", "knee-high boots"],
      outerwear: ["", "military coat", "long coat", "cape"],
      head: ["", "military hat", "peaked cap", "beret", "helmet"],
      accessory: ["", "belt", "gloves", "epaulettes", "holster"]
    }
  },

  gymswim: {
    label: "体操服・スク水",
    slots: {
      main: [
        "gym uniform, buruma", "white shirt, buruma", "school swimsuit",
        "one-piece school swimsuit", "gym shirt, short shorts", "sailor swimsuit"
      ],
      legwear: ["white socks", "kneehighs", "", "loose socks"],
      shoes: ["sneakers", "indoor shoes", "uwabaki", "barefoot"],
      outerwear: ["", "", "track jacket", "gym jacket"],
      head: ["", "headband", "hair tie", "swim cap"],
      accessory: ["", "name tag", "whistle", "towel around neck"]
    }
  },

  ethnic: {
    label: "民族衣装",
    slots: {
      main: [
        "folk costume", "dirndl", "traditional dress, embroidery",
        "ethnic dress", "peasant blouse, embroidered skirt", "flamenco dress"
      ],
      legwear: ["white stockings", "", "knee socks"],
      shoes: ["leather shoes", "sandals", "ankle boots"],
      outerwear: ["", "shawl", "embroidered vest", "apron"],
      head: ["flower crown", "headscarf", "braided hair", "flower hair ornament", ""],
      accessory: ["", "beaded necklace", "embroidered sash", "folk jewelry"]
    }
  }
};
