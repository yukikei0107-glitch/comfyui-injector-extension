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
        "serafuku, sailor collar, short sleeves, pleated skirt, neckerchief",
        "long-sleeve serafuku, sailor collar, pleated skirt, white ribbon",
        "summer serafuku, short sleeves, sailor collar, blue neckerchief, pleated skirt",
        "navy blazer, dress shirt, red ribbon, plaid pleated skirt",
        "blazer, cardigan, necktie, dress shirt, gray pleated skirt",
        "sailor dress, white collar, pleated hem, ribbon",
        "sweater vest, dress shirt, striped necktie, pleated skirt",
        "winter serafuku, long sleeves, sailor collar, pleated skirt, scarf",
        "blazer, argyle sweater vest, dress shirt, plaid skirt",
        "sailor dress, long pleated skirt, white trim, ribbon",
        "gakuran-style jacket, high collar, buttons, pleated skirt"
      ],
      legwear: ["black thighhighs, zettai ryouiki", "white thighhighs", "sheer black pantyhose", "loose socks, white", "white kneehighs", "black kneehighs, zettai ryouiki"],
      shoes: ["brown loafers", "black loafers, ankle socks", "red uwabaki", "white sneakers"],
      outerwear: ["", "", "beige school cardigan", "navy duffle coat", "blazer draped over shoulders"],
      head: ["", "red hair ribbon", "star hairclip", "large hair bow"],
      accessory: ["", "", "leather school bag", "loosened necktie", "name tag, lanyard"]
    }
  },

  casual: {
    label: "カジュアル",
    slots: {
      main: [
        "oversized t-shirt, ripped denim shorts, belt",
        "cropped hoodie, high-waist pleated skirt",
        "chunky oversized sweater, black thighhighs",
        "off-shoulder knit sweater, mini skirt",
        "ribbed crop top, high-waist jeans, belt",
        "puff-sleeve blouse, suspender skirt",
        "turtleneck sweater, corduroy skirt, brown belt",
        "graphic tee, oversized cargo pants, chain",
        "lace camisole, open cardigan, denim shorts",
        "off-shoulder top, wide-leg trousers",
        "ribbed knit dress, thin belt",
        "zip-up parka, plaid mini skirt",
        "long shirt dress, rolled sleeves",
        "denim overalls, striped shirt"
      ],
      legwear: ["", "", "black thighhighs", "white crew socks", "over-knee socks", "ribbed ankle socks"],
      shoes: ["white sneakers", "canvas high-top sneakers", "chunky sneakers", "brown ankle boots", "strappy sandals"],
      outerwear: ["", "", "oversized denim jacket", "bomber jacket", "chunky oversized cardigan", "plaid shirt tied around waist"],
      head: ["", "", "knit beanie", "baseball cap", "colorful hair clips"],
      accessory: ["", "", "crossbody shoulder bag", "mini backpack", "layered choker", "hoop earrings"]
    }
  },

  mizugi: {
    label: "水着",
    slots: {
      main: [
        "white string bikini, frills", "black halterneck bikini, gold accents",
        "polka dot bikini, ribbon ties", "frilled bikini, off-shoulder",
        "sailor-collar swimsuit, ribbon", "criss-cross bikini top, side-tie bottom",
        "navy competition swimsuit, high-cut", "one-piece swimsuit, keyhole",
        "sling bikini", "micro bikini, thin straps",
        "striped tankini", "bikini top, sheer sarong wrap",
        "front-tie bikini, halterneck", "high-leg swimsuit, zipper"
      ],
      legwear: ["", "", ""],
      shoes: ["barefoot", "flip-flops", "strappy sandals", "beach sandals"],
      outerwear: ["", "", "sheer floral pareo", "open beach jacket", "unbuttoned white shirt"],
      head: ["", "wide-brim straw sun hat", "sunglasses on head", "hibiscus flower hair ornament"],
      accessory: ["", "", "clear swim ring", "beach ball", "heart-shaped sunglasses", "shell anklet"]
    }
  },

  wasou: {
    label: "和装",
    slots: {
      main: [
        "floral kimono, wide obi, obijime", "cotton yukata, obi, floral print",
        "elegant kimono, embroidered obi, obidome", "furisode, elaborate obi, long sleeves",
        "kimono top, hakama, ribbon", "red kimono, gold obi, floral pattern",
        "striped yukata, contrasting obi", "kimono, obi, fur collar"
      ],
      legwear: ["white tabi socks", "white tabi socks", ""],
      shoes: ["wooden geta", "zori sandals", "tall okobo"],
      outerwear: ["", "", "haori jacket", "embroidered shawl"],
      head: ["", "dangling kanzashi", "flower hair ornament, tsumami kanzashi", "lacquered hair stick"],
      accessory: ["", "", "folding fan", "oil-paper umbrella", "kinchaku drawstring bag"]
    }
  },

  fantasy: {
    label: "ファンタジー",
    slots: {
      main: [
        "ornate fantasy dress, corset, gold trim", "studded leather armor, tunic, belt",
        "mage robe, hood, arcane trim", "silver knight armor, breastplate, tassets",
        "witch dress, layered skirt, buckles", "priestess robe, gold embroidery, sash",
        "adventurer outfit, tunic, leather belt, pouches", "elf dress, flowing cape, leaf motif",
        "ornate battle dress, armored corset", "dark sorceress dress, thigh slit"
      ],
      legwear: ["thighhighs, garter straps", "armored leggings", "black thighhighs, garter", ""],
      shoes: ["knee-high boots, buckles", "armored greaves", "worn leather boots", "thigh-high boots"],
      outerwear: ["", "flowing cape", "hooded cloak, fur trim", "fur-trimmed mantle"],
      head: ["", "gem circlet", "wide-brim witch hat", "ornate tiara", "deep hood"],
      accessory: ["", "ornate staff", "sword at hip", "spellbook, glowing runes", "glowing amulet"]
    }
  },

  heyagi: {
    label: "部屋着",
    slots: {
      main: [
        "oversized t-shirt, bare legs", "lace camisole, short shorts",
        "button-up pajamas, chest pocket", "cropped hoodie, boyshorts",
        "long silk nightgown, thin straps", "loose sweatshirt, sweatpants",
        "ribbed tank top, sleep shorts", "fluffy fleece loungewear set"
      ],
      legwear: ["", "", "loose slouch socks", "knee socks", "fuzzy socks"],
      shoes: ["barefoot", "fluffy slippers", "bunny slippers"],
      outerwear: ["", "", "open oversized cardigan", "blanket draped over shoulders", "fluffy bathrobe"],
      head: ["", "messy hair", "loose hair bun", "sleep mask on forehead"],
      accessory: ["", "", "hugging a pillow", "holding a steaming mug", "holding a stuffed animal"]
    }
  },

  dress: {
    label: "ドレス",
    slots: {
      main: [
        "flowing evening gown, thigh slit", "fitted cocktail dress",
        "little black dress, off-shoulder", "red evening dress, backless",
        "off-shoulder gown, sweetheart neckline", "delicate lace dress",
        "layered ball gown, corset bodice", "elegant white dress, draped",
        "sequined dress, shimmering", "velvet gown, deep neckline"
      ],
      legwear: ["sheer black pantyhose", "", "white thighhighs"],
      shoes: ["strappy high heels", "stiletto heels", "ankle-strap heels", "pointed pumps"],
      outerwear: ["", "", "sheer shawl", "white fur stole", "opera gloves"],
      head: ["", "delicate tiara", "hair flower", "elegant updo"],
      accessory: ["", "pearl necklace", "diamond drop earrings", "beaded clutch bag", "long satin gloves"]
    }
  },

  gothic: {
    label: "ゴシック/ロリータ",
    slots: {
      main: [
        "gothic lolita dress, layered frills, ribbon", "black and red lolita dress, lace trim",
        "frilled gothic dress, cross motif", "sweet lolita dress, pastel, bows",
        "victorian dress, high collar, lace", "corset dress, ruffled skirt, ribbon lacing"
      ],
      legwear: ["black thighhighs, lace trim", "white lace stockings", "black and white striped tights"],
      shoes: ["mary janes, bows", "platform boots, buckles", "buckle shoes", "rocking horse shoes"],
      outerwear: ["", "", "frilled bolero", "lace capelet"],
      head: ["frilled headband", "lace bonnet", "mini top hat, ribbon", "lace headdress"],
      accessory: ["", "lace parasol", "ribbon choker", "lace gloves"]
    }
  },

  sports: {
    label: "スポーツ",
    slots: {
      main: [
        "sports bra, running shorts", "fitted tank top, track shorts",
        "gym shirt, buruma", "pleated tennis dress", "track jacket, track pants, stripes",
        "athletic leotard", "volleyball jersey, spandex shorts",
        "cropped yoga top, high-waist leggings", "cycling jersey, bike shorts"
      ],
      legwear: ["athletic crew socks", "knee-high sports socks", ""],
      shoes: ["running sneakers", "trainer shoes", "tennis shoes", "high-top sneakers"],
      outerwear: ["", "", "zip-up track jacket", "windbreaker"],
      head: ["", "sweat headband", "sun visor", "sports cap", "high ponytail"],
      accessory: ["", "", "wrist sweatband", "water bottle", "towel around neck"]
    }
  },

  maid: {
    label: "メイド",
    slots: {
      main: [
        "classic maid outfit, frilled apron", "maid dress, white apron, puffy sleeves",
        "victorian maid dress, long skirt, lace", "black maid dress, white pinafore apron",
        "frilled maid dress, ribbon", "short maid dress, layered petticoat",
        "long maid dress, puffy sleeves, ruffles", "gothic maid dress, corset"
      ],
      legwear: ["black thighhighs", "white thighhighs, lace trim", "sheer black pantyhose", "white stockings, lace trim"],
      shoes: ["mary janes", "low black heels", "buckle shoes"],
      outerwear: ["", "", "lace shawl"],
      head: ["frilled maid headdress", "frilled hairband", "white lace headdress", "maid headdress, ribbon"],
      accessory: ["", "frilled wrist cuffs", "feather duster", "silver serving tray", "black lace choker", "frilled apron"]
    }
  },

  nurse: {
    label: "ナース",
    slots: {
      main: [
        "white nurse uniform, buttons", "white nurse dress, short sleeves",
        "pink nurse uniform, apron", "short nurse dress, zipper",
        "nurse dress, front zipper, belt", "sleeveless nurse dress, collar"
      ],
      legwear: ["white thighhighs", "sheer white pantyhose", "white kneehighs", ""],
      shoes: ["white nurse shoes", "white sneakers", "low white heels"],
      outerwear: ["", "", "open white coat", "cardigan"],
      head: ["nurse cap", "nurse cap, red cross", ""],
      accessory: ["", "stethoscope around neck", "holding a syringe", "clipboard", "wrist watch"]
    }
  },

  miko: {
    label: "巫女",
    slots: {
      main: [
        "miko outfit, white kosode, red hakama", "white kimono top, red hakama, ribbon",
        "miko, red nagabakama, wide sleeves", "detached wide sleeves, red hakama",
        "white kosode, red nagabakama, obi"
      ],
      legwear: ["white tabi socks", "white tabi socks", "", "white thighhighs"],
      shoes: ["zori sandals", "wooden geta", "sandals"],
      outerwear: ["", "haori jacket", "white chihaya, embroidery"],
      head: ["", "white hair ribbon", "white ribbon, long hair", "flower hair ornament"],
      accessory: ["", "holding ofuda", "holding gohei", "folding fan", "kagura suzu bell"]
    }
  },

  china: {
    label: "チャイナ服",
    slots: {
      main: [
        "china dress, floral embroidery", "red china dress, gold dragon embroidery",
        "blue china dress, gold trim, mandarin collar", "short china dress, thigh slit",
        "china dress, deep thigh slit, side buttons", "elegant cheongsam, long",
        "sleeveless china dress, frog buttons", "floral china dress, short sleeves"
      ],
      legwear: ["black thighhighs", "china dress, pelvic curtain", "white thighhighs", ""],
      shoes: ["heels", "flat shoes", "mary janes"],
      outerwear: ["", ""],
      head: ["double bun, hair sticks", "hair buns, ornaments", "peony flower hair ornament", ""],
      accessory: ["", "chinese knot tassel", "folding fan", "gold bangle bracelet", "jade hair stick"]
    }
  },

  office: {
    label: "OL・オフィス",
    slots: {
      main: [
        "tailored business suit, pencil skirt", "office lady, silk blouse, tight skirt",
        "blazer, dress shirt, pencil skirt, belt", "fitted suit, tight skirt, slit",
        "vest, dress shirt, high-waist skirt", "ruffled blouse, high-waist skirt"
      ],
      legwear: ["sheer black pantyhose", "black pantyhose", "black thighhighs", ""],
      shoes: ["black high heels", "pointed heels", "pumps"],
      outerwear: ["", "", "tailored blazer", "suit jacket", "beige trench coat"],
      head: ["", "", "thin-frame glasses", "neat hair bun", "low ponytail"],
      accessory: ["", "glasses", "necktie", "id card lanyard", "leather handbag", "wristwatch"]
    }
  },

  idol: {
    label: "アイドル",
    slots: {
      main: [
        "idol costume, layered frills", "frilly idol dress, ribbons, bows",
        "sparkly idol outfit, sequins", "idol dress, tiered ruffled skirt",
        "pop idol costume, layered skirt, star motif", "frilled idol dress, ribbons, corset"
      ],
      legwear: ["white thighhighs, ribbon", "striped thighhighs", "frilled thighhighs", "over-knee socks"],
      shoes: ["knee-high boots, laces", "mary janes", "white ankle boots", "platform shoes"],
      outerwear: ["", "short frilled cape", "detached puffy sleeves"],
      head: ["large hair bow", "sparkly tiara", "oversized hair bow", "star hair ornament", "idol headset"],
      accessory: ["", "frilled gloves", "holding a microphone", "wrist cuffs", "star accessory"]
    }
  },

  bunny: {
    label: "バニー",
    slots: {
      main: [
        "playboy bunny, strapless leotard", "classic bunny suit, detached collar",
        "black bunny leotard, high-cut", "white bunny suit, gold trim",
        "strapless bunny leotard, thin straps", "red bunny suit, corset"
      ],
      legwear: ["black pantyhose", "fishnet pantyhose", "sheer pantyhose"],
      shoes: ["black high heels", "stiletto heels"],
      outerwear: ["", ""],
      head: ["rabbit ears headband", "fake bunny ears", "bunny ears, ribbon"],
      accessory: ["frilled wrist cuffs", "black bowtie", "detached collar, cuffs", "fluffy rabbit tail"]
    }
  },

  wedding: {
    label: "ウェディング",
    slots: {
      main: [
        "elegant wedding dress, lace", "white wedding dress, long train",
        "strapless wedding dress, sweetheart neckline", "delicate lace wedding dress",
        "layered ball gown wedding dress", "fitted mermaid wedding dress"
      ],
      legwear: ["white thighhighs", "", "white stockings, lace trim"],
      shoes: ["white heels", "white high heels, ribbon", "strappy heels"],
      outerwear: ["", "sheer shawl", "bridal cape, lace"],
      head: ["long bridal veil", "sheer veil", "pearl tiara", "white flower crown", "white flower hair ornament"],
      accessory: ["", "holding a bouquet", "pearl necklace", "long white satin gloves"]
    }
  },

  magical: {
    label: "魔法少女",
    slots: {
      main: [
        "magical girl outfit, layered frills", "magical girl dress, frills, ribbons",
        "magical girl dress, tiered layered skirt", "sailor-style magical girl outfit, ribbon",
        "frilly magical girl costume, bows, gem"
      ],
      legwear: ["white thighhighs, ribbon", "striped thighhighs", "over-knee socks", "frilled thighhighs"],
      shoes: ["knee-high boots, ribbon", "mary janes", "white ankle boots", "ribbon-laced boots"],
      outerwear: ["", "short cape", "flowing ribbons", "detached puffy sleeves"],
      head: ["jeweled tiara", "large hair bow", "oversized ribbon", "gem circlet", "magical girl hair ornament"],
      accessory: ["ornate magic wand", "frilled gloves", "heart brooch", "star accessory"]
    }
  },

  military: {
    label: "軍服",
    slots: {
      main: [
        "military uniform, epaulettes, buttons", "military uniform, pleated skirt, belt",
        "officer uniform, gold trim, medals", "camouflage uniform, tactical vest",
        "military jacket, short shorts, belt", "combat uniform, harness"
      ],
      legwear: ["black thighhighs", "", "black pantyhose", "knee-high socks"],
      shoes: ["laced combat boots", "military boots", "knee-high boots"],
      outerwear: ["", "long military coat", "greatcoat", "cape"],
      head: ["", "military peaked cap", "officer cap, insignia", "beret", "combat helmet"],
      accessory: ["", "utility belt", "leather gloves", "gold epaulettes", "hip holster"]
    }
  },

  gymswim: {
    label: "体操服・スク水",
    slots: {
      main: [
        "white gym shirt, navy buruma", "white shirt, buruma, name tag",
        "navy school swimsuit, white name tag", "navy one-piece school swimsuit",
        "gym shirt, short shorts", "sailor-collar school swimsuit"
      ],
      legwear: ["white crew socks", "kneehighs", "", "loose socks"],
      shoes: ["white sneakers", "indoor shoes", "uwabaki", "barefoot"],
      outerwear: ["", "", "zip-up track jacket", "gym jacket"],
      head: ["", "sweat headband", "hair tie, high ponytail", "swim cap"],
      accessory: ["", "name tag", "whistle on lanyard", "towel around neck"]
    }
  },

  ethnic: {
    label: "民族衣装",
    slots: {
      main: [
        "folk costume, embroidered blouse, apron", "bavarian dirndl, lace-up bodice",
        "traditional dress, floral embroidery", "ethnic dress, colorful patterns",
        "peasant blouse, embroidered skirt, sash", "flamenco dress, ruffled tiers"
      ],
      legwear: ["white stockings", "", "knee socks"],
      shoes: ["leather shoes", "strappy sandals", "ankle boots"],
      outerwear: ["", "embroidered shawl", "embroidered vest", "frilled apron"],
      head: ["flower crown", "embroidered headscarf", "braided hair, ribbons", "flower hair ornament", ""],
      accessory: ["", "beaded necklace", "embroidered sash", "folk jewelry, coins"]
    }
  }
};

// ===== 動作ガチャ =====
// ACTION_SLOTS: 動作リールの並びとラベル。ACTION_THEMES: テーマ別の各リール候補（Danbooru系タグ）。
window.ACTION_SLOTS = [
  { key: "pose",       label: "ポーズ" },
  { key: "expression", label: "表情" },
  { key: "hands",      label: "手/腕" },
  { key: "camera",     label: "カメラ" },
  { key: "background", label: "背景" }
];

// 背景（幾何学模様＋定番）候補。テーマ共通で使う。
// プロンプト末尾で埋もれてしまうので強調ウェイト付き。数値を上げるとより主張が強くなる。
window.ACTION_BACKGROUNDS = [
  "(geometric background:1.3)", "(polka dot background:1.3)", "(striped background:1.3)",
  "(checkered background:1.3)", "(argyle background:1.3)", "(halftone background:1.3)",
  "(grid background:1.3)", "(plaid background:1.3)", "(floral background:1.3)",
  "(heart background:1.3)", "(starry background:1.3)", "(sparkle background:1.3)",
  "(sunburst:1.3)", "(colorful background:1.3)", "(abstract background:1.2)",
  "(emphasis lines:1.2)", "(speed lines:1.2)"
];

window.ACTION_THEMES = {
  omakase: { label: "🎲 おまかせ", random: true },

  natural: {
    label: "日常/自然",
    slots: {
      pose: ["standing, relaxed posture", "sitting, legs together", "walking, mid-stride",
             "leaning forward slightly", "leaning back, relaxed", "cross-legged sitting",
             "kneeling, upright", "standing on one leg, off-balance", "crouching, knees bent",
             "head tilt, standing"],
      expression: ["soft smile", "light smile, closed mouth", "closed eyes, calm expression",
                   "open mouth, happy", "faint blush, smile", "happy, bright smile",
                   "smile, open mouth, cheerful", "neutral expression", "gentle smile, relaxed"],
      hands: ["hand on own cheek", "own hands clasped together", "adjusting hair, hand raised",
              "hand in own hair", "hands behind back", "one arm behind back",
              "hands resting on lap", "holding own arm"],
      camera: ["looking at viewer", "looking to the side", "upper body", "cowboy shot",
               "from side, eye level", "straight-on"]
    }
  },

  standing: {
    label: "立ちポーズ",
    slots: {
      pose: ["standing, confident posture", "contrapposto, weight on one leg", "standing on one leg, poised",
             "standing on tiptoes", "arms at sides, straight posture", "leaning back slightly",
             "twisted torso, dynamic stance", "walking, mid-stride", "back turned, looking over shoulder",
             "hand on own hip, cocked hip"],
      expression: ["gentle smile", "light smile, closed mouth", "confident smile", "closed mouth, calm",
                   "open mouth, cheerful", "cool expression, composed"],
      hands: ["hand on own hip", "both hands on hips", "arms crossed under chest", "hands clasped behind back",
              "hand in own hair", "one arm raised", "peace sign, hand up", "hands behind head"],
      camera: ["full body", "cowboy shot", "from below, low angle", "from side", "looking at viewer", "dynamic angle"]
    }
  },

  sitting: {
    label: "座り",
    slots: {
      pose: ["sitting, hands on lap", "wariza, knees together", "seiza, upright", "yokozuwari, legs to one side",
             "cross-legged sitting, relaxed", "sitting on chair, legs crossed", "sitting on floor, leaning back on arms",
             "knees drawn to chest", "hugging own legs", "sitting on bed, relaxed", "kneeling, hands on thighs"],
      expression: ["soft smile", "light smile, closed mouth", "closed eyes, calm", "faint blush",
                   "gentle smile, relaxed", "open mouth, cheerful"],
      hands: ["hands resting on lap", "hands on own knees", "hand on own cheek, elbow on knee",
              "hands clasped behind back", "own hands together", "adjusting hair", "arms supporting from behind"],
      camera: ["from above, high angle", "from side", "cowboy shot", "upper body", "looking at viewer", "eye level"]
    }
  },

  lying: {
    label: "寝そべり",
    slots: {
      pose: ["lying on back, relaxed", "on back, arms above head", "on stomach, legs raised behind",
             "lying on side, propped up", "arms up, stretched out", "knees up, lying down",
             "legs raised in air", "stretching while lying", "curled up on side", "one arm raised, lying"],
      expression: ["soft smile", "closed eyes, peaceful", "sleepy, half-lidded eyes", "faint blush",
                   "light smile, relaxed", "open mouth, yawn", "half-closed eyes, drowsy"],
      hands: ["arms stretched above head", "hands above head", "hand on own cheek", "own hands together",
              "one arm raised", "hands behind head"],
      camera: ["from above, top-down", "from side, low angle", "close-up", "looking at viewer", "dutch angle", "upper body"]
    }
  },

  dynamic: {
    label: "アクション",
    slots: {
      pose: ["running at full speed", "jumping high, mid-air", "mid-air, legs bent", "leaping forward",
             "fighting stance, ready", "dynamic action pose", "action pose, motion", "high kick",
             "leaning forward, charging", "outstretched arm, reaching", "twisting mid-motion"],
      expression: ["open mouth, shouting", "shouting, intense", "determined, focused", "fierce grin",
                   "serious, sharp eyes", "clenched teeth, effort", "confident smirk"],
      hands: ["outstretched arm, open hand", "reaching out toward viewer", "clenched fist", "arm raised high",
              "pointing forward", "both arms out"],
      camera: ["dynamic angle", "from below, dramatic", "foreshortening", "wide action shot", "full body", "motion blur"]
    }
  },

  cute: {
    label: "あざとかわいい",
    slots: {
      pose: ["standing, leaning toward viewer", "leaning forward, playful", "head tilt, cute",
             "knees together, shy stance", "pigeon-toed, knees together", "little curtsey",
             "wariza, hands on knees", "on tiptoes, leaning", "mid-hop, cheerful"],
      expression: ["smile, open mouth, cheerful", "wink, tongue out", "one eye closed, playful", ":d, wide smile",
                   "happy, sparkling eyes", "blush, sweet smile", "tongue out, teasing", "star-shaped pupils, excited"],
      hands: ["peace sign near face", "double peace sign", "hand up, waving", "finger to mouth",
              "hands on own cheeks", "heart hands", "paw pose, both hands", "waving with both hands", "v over one eye"],
      camera: ["looking at viewer", "from above, cute angle", "close-up", "upper body", "face focus", "selfie angle"]
    }
  },

  cool: {
    label: "クール",
    slots: {
      pose: ["standing, confident stance", "leaning against wall, casual", "back turned, glancing back",
             "looking over shoulder, cool", "contrapposto, poised", "walking, composed",
             "hand on own hip, cocked hip", "arms crossed, confident"],
      expression: ["expressionless, cool", "serious, sharp gaze", "smug smirk", "half-closed eyes, aloof",
                   "closed mouth, calm", "cool composed expression", "slight frown"],
      hands: ["arms crossed under chest", "hand on own hip", "hands in pockets", "hand in own hair, sweeping",
              "adjusting eyewear", "one arm raised, relaxed"],
      camera: ["from below, low angle", "from side", "looking to the side", "dutch angle", "cowboy shot", "profile view"]
    }
  },

  sexy: {
    label: "セクシー",
    slots: {
      pose: ["arched back, curvy pose", "bent over slightly, looking back", "leaning forward, alluring",
             "lying on side, propped up", "on back, relaxed", "kneeling, back arched",
             "sitting, legs crossed elegantly", "looking over shoulder, sultry", "twisted torso, hip emphasis"],
      expression: ["seductive smile", "half-closed eyes, sultry", "soft blush", "parted lips",
                   "bedroom eyes", "light smile, alluring", "looking at viewer, teasing smile"],
      hands: ["hand on own hip, other arm relaxed", "hand in own hair, sweeping", "hands on own thighs",
              "hand on own chest", "touching own face", "adjusting hair, elbow raised"],
      camera: ["from below, flattering angle", "from side", "looking at viewer", "close-up", "cowboy shot", "dutch angle"]
    }
  },

  camerawork: {
    label: "カメラワーク",
    slots: {
      pose: ["standing, relaxed", "sitting, casual", "leaning forward toward camera", "looking back over shoulder", "lying down"],
      expression: ["looking at viewer", "soft smile", "light smile, closed mouth", "closed eyes, calm", "open mouth"],
      hands: ["hand near face, framing", "adjusting hair", "hand up, gesturing", "own hands together"],
      camera: ["from above, high angle", "from below, low angle", "from side", "from behind", "dutch angle, tilted",
               "extreme close-up", "portrait framing", "foreshortening", "pov", "wide establishing shot", "fisheye lens", "face focus"]
    }
  },

  dance: {
    label: "ダンス",
    slots: {
      pose: ["dancing, arms flowing", "arms up, mid-dance", "twirling, skirt flip", "leg up, dance kick",
             "spinning, dynamic", "ballet pose, on pointe", "jumping mid-dance", "dynamic dance pose",
             "one leg raised high", "leaning back, arms extended"],
      expression: ["smile, open mouth, joyful", "happy, bright smile", "closed eyes, into the music",
                   "light smile, graceful", "energetic grin", "singing, open mouth"],
      hands: ["both arms raised gracefully", "one arm raised", "outstretched arms, flowing", "hands up high",
              "reaching out, expressive", "arms spread wide"],
      camera: ["full body", "dynamic angle", "from below, dramatic", "wide shot", "cowboy shot", "motion blur"]
    }
  },

  shy: {
    label: "照れ/恥じらい",
    slots: {
      pose: ["standing, fidgeting", "knees together, timid", "pigeon-toed, shy stance", "leaning forward, bashful",
             "hunched over shyly", "legs together, nervous", "head down, embarrassed"],
      expression: ["deep blush", "embarrassed, blushing", "shy, downcast eyes", "half-closed eyes, bashful",
                   "looking away, blushing", "nervous smile", "flustered, red face", "teary eyes, embarrassed"],
      hands: ["own hands together, fidgeting", "fingers pressed together", "hand on own flushed cheek",
              "covering mouth with hand", "hands clutched to chest", "playing with own hair nervously",
              "hands clasped behind back"],
      camera: ["looking away", "looking to the side", "upper body", "close-up", "from above", "face focus"]
    }
  },

  energetic: {
    label: "元気/はしゃぎ",
    slots: {
      pose: ["jumping high, joyful", "arms up, celebrating", "running happily", "standing on one leg, playful",
             "leaning forward, energetic", "mid-hop, excited", "victory pose", "arms spread wide, free"],
      expression: ["smile, open mouth, laughing", ":d, big smile", "energetic grin", "happy, sparkling eyes",
                   "wink, cheerful", "excited, wide eyes"],
      hands: ["both arms raised high", "double peace sign", "peace sign near face", "waving enthusiastically",
              "thumbs up", "hands up, celebrating", "v sign"],
      camera: ["full body", "from below, dynamic", "dynamic angle", "cowboy shot", "looking at viewer", "wide shot"]
    }
  },

  model: {
    label: "モデル/ポートレート",
    slots: {
      pose: ["contrapposto, fashion pose", "hand on own hip, model stance", "standing tall, elegant",
             "leaning back, poised", "twisted torso, editorial pose", "legs crossed while standing",
             "looking over shoulder, glamorous"],
      expression: ["light smile, elegant", "closed mouth, poised", "cool composed expression", "serious, editorial",
                   "confident gaze", "subtle smirk"],
      hands: ["hand on own hip", "both hands on hips", "hand in own hair, sweeping", "hand on own chin",
              "arms crossed elegantly", "hand near face, framing"],
      camera: ["from below, flattering", "from side", "cowboy shot", "full body", "portrait framing", "profile view"]
    }
  },

  crying: {
    label: "泣き/感情",
    slots: {
      pose: ["sitting, slumped", "hugging own legs tightly", "kneeling, head bowed", "curled up, trembling",
             "leaning forward, shoulders shaking", "head down, sobbing", "trembling, arms limp"],
      expression: ["crying, tears streaming", "tears, sad eyes", "sad, downcast", "teary eyes, welling up",
                   "crying with eyes open", "deep frown, sorrowful", "sobbing, open mouth", "wavy mouth, holding back tears"],
      hands: ["wiping tears with hand", "hands covering own face", "covering face, both hands", "hands clutched to chest",
              "clenched trembling hands", "hand over own mouth"],
      camera: ["close-up, emotional", "from above", "upper body", "face focus", "looking down", "dutch angle"]
    }
  },

  combat: {
    label: "バトル/戦闘",
    slots: {
      pose: ["fighting stance, guard up", "battle stance, ready", "holding sword, poised to strike", "sword raised overhead",
             "punching forward", "high kick, mid-motion", "defensive guard pose", "leaping attack",
             "dodging, evasive lean", "aiming steadily"],
      expression: ["serious, focused", "determined, fierce eyes", "clenched teeth, effort", "angry, glaring",
                   "confident battle grin", "shouting, battle cry"],
      hands: ["holding sword with both hands", "gripping weapon tightly", "clenched fist raised", "outstretched arm, ready",
              "drawing sword from sheath", "aiming with steady hands", "clenched fist"],
      camera: ["from below, heroic angle", "dynamic angle", "foreshortening", "wide battle shot", "full body", "motion blur"]
    }
  },

  relax: {
    label: "リラックス",
    slots: {
      pose: ["sitting, leaning back relaxed", "lying down, at ease", "leaning back, arms behind",
             "stretching lazily", "cross-legged sitting, calm", "reclining comfortably",
             "lying on side, cozy", "arms behind head, relaxed"],
      expression: ["closed eyes, content", "light smile, at ease", "sleepy, drowsy", "relaxed, peaceful",
                   "yawning", "gentle smile, calm"],
      hands: ["arms behind head", "hands behind head, relaxed", "stretching arms overhead", "hand on own cheek",
              "holding a warm cup", "hands resting on lap"],
      camera: ["from above", "from side", "upper body", "cowboy shot", "looking at viewer", "eye level"]
    }
  },

  casting: {
    label: "魔法/詠唱",
    slots: {
      pose: ["arms raised, casting spell", "outstretched arm, channeling magic", "holding staff aloft",
             "floating in air", "standing, ready to cast", "leaning forward, focusing power",
             "both arms outstretched, incantation"],
      expression: ["serious, concentrating", "closed eyes, focused", "determined, intense", "confident, powerful", "gentle smile, serene"],
      hands: ["outstretched hand, glowing palm", "holding staff", "both arms raised", "pointing forward, casting",
              "open palm, energy gathering", "holding a wand"],
      camera: ["from below, dramatic", "dynamic angle", "full body", "wide shot", "foreshortening", "backlighting"]
    }
  }
};
