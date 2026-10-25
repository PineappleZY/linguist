# Linguist 7.0.0 — 界面文案对照表

这份表是 `web/js/strings.js` 的直接产物（`node tools/strings-md.mjs` 重新生成），供你或母语者复核。共 **463 条 × 5 种语言**。

**怎么用**：切到某一语言后，可能觉得某句不像该语言的人会说的话——直接在表里指出 key 与建议改法即可，我会改 `strings.js`（改一行，五个语言各自独立）。

**6.5 最没把握的几处**：

| key | 我的顾虑 |
| --- | --- |
| `practice.replayLocked` | 「先用一次提示」要够短（扬声器的 title）又不至于像报错；德语与法语容易变长 |
| `theme.auto` / `theme.light` / `theme.dark` | 三个主题名在各语言里的常用度；德语 „Automatisch" 偏长，是否该用 „System" |
| `model.flash.hint` / `model.pro.hint` | 「1M 上下文」的写法：100 万 / 1 Mio. / 1 M，以及破折号后的卖点是否自然 |
| `field.via` / `field.attested` / `field.certainty` | 词源事实的三个标签；法语 « Première attestation » 是否过长，德语 „Belegt seit" 是否更惯用 |
| `field.on` / `field.kun` / `field.special` | 日语读音的三个小标题：英语用 On/Kun readings，法语 « Lectures on » 是否够自然，或该直接留「音読み / 訓読み」 |
| `entry.irregularComparison` | 比较级提示要短、要像注释而不是报错 |
| `app.description` | 名字在五种语言里都写成 `Linguist`（刻意的）。简介按各自惯用写法重写 |

| key | English | 中文 | Français | Deutsch | 日本語 |
| --- | --- | --- | --- | --- | --- |
| `nav.dictionary` | Dictionary | 词典 | Dictionnaire | Wörterbuch | 辞書 |
| `nav.starred` | Starred | 星标 | Favoris | Favoriten | お気に入り |
| `nav.profile` | Profile | 个人 | Profil | Profil | 個人 |
| `nav.roots` | Roots | 词根 | Racines | Wurzeln | 語根 |
| `roots.sub` | Learn the parts words are made of | 从构词的部件真正读懂单词 | Apprendre les pièces qui forment les mots | Die Bausteine der Wörter lernen | 語を組み立てる部品を学ぶ |
| `roots.detail` | Root | 词根 | Racine | Wurzel | 語根 |
| `roots.stat.due` | Due | 待复习 | À revoir | Fällig | 復習待ち |
| `roots.stat.learning` | Learning | 在学 | En cours | Im Lernen | 学習中 |
| `roots.stat.known` | Known | 已掌握 | Maîtrisées | Gelernt | 習得済み |
| `roots.stat.words` | Words covered | 覆盖词数 | Mots couverts | Abgedeckte Wörter | 対象語数 |
| `roots.emptyTitle` | No roots yet | 还没有词根 | Pas encore de racines | Noch keine Wurzeln | 語根はまだありません |
| `roots.emptyText` | Look up a word with an etymology card, then come back. | 先查一个已经生成词源卡片的词，再回来。 | Cherchez un mot avec une carte étymologique, puis revenez. | Schlage ein Wort mit Etymologiekarte nach und komm zurück. | 語源カードのある語を調べてから戻ってください。 |
| `roots.review` | Review {n} roots | 复习 {n} 个词根 | Revoir {n} racines | {n} Wurzeln wiederholen | {n} 個の語根を復習 |
| `roots.all` | All roots | 全部词根 | Toutes les racines | Alle Wurzeln | すべての語根 |
| `roots.state.new` | New | 新词根 | Nouvelle | Neu | 新規 |
| `roots.state.learning` | Learning | 在学 | En cours | Im Lernen | 学習中 |
| `roots.state.familiar` | Familiar | 渐熟 | Familière | Vertraut | 慣れてきた |
| `roots.state.known` | Known | 已掌握 | Maîtrisée | Gelernt | 習得済み |
| `roots.notFound` | This root is not on this device. | 本机没有这个词根。 | Cette racine n’est pas sur cet appareil. | Diese Wurzel ist auf diesem Gerät nicht vorhanden. | この語根はこの端末にありません。 |
| `roots.variants` | Variants | 变体 | Variantes | Varianten | 異形 |
| `roots.reviewOne` | Review this root | 复习这个词根 | Revoir cette racine | Diese Wurzel wiederholen | この語根を復習 |
| `roots.family` | Root family | 同根词族 | Famille de racines | Wortfamilie | 同根語 |
| `roots.sources` | Words in your history | 历史中的词 | Mots de votre historique | Wörter aus deinem Verlauf | 履歴の語 |
| `roots.reviewTitle` | Root review | 词根复习 | Révision des racines | Wurzelwiederholung | 語根の復習 |
| `roots.question` | Question {n} of {total} | 第 {n} / {total} 题 | Question {n} sur {total} | Frage {n} von {total} | 第 {n} / {total} 問 |
| `roots.inputRoot` | Type the root | 输入词根 | Écrivez la racine | Wurzel eingeben | 語根を入力 |
| `roots.inputWord` | Type one word from this root family | 输入一个同根词 | Écrivez un mot de cette famille | Ein Wort dieser Familie eingeben | この語根の語を一つ入力 |
| `roots.choiceMeaning` | Choose the meaning | 选择含义 | Choisissez le sens | Bedeutung wählen | 意味を選ぶ |
| `roots.right` | Correct — {answer} | 正确——{answer} | Correct — {answer} | Richtig — {answer} | 正解 — {answer} |
| `roots.wrong` | The answer is {answer} | 答案是 {answer} | La réponse est {answer} | Die Antwort ist {answer} | 答えは {answer} |
| `roots.finished` | Review complete | 复习完成 | Révision terminée | Wiederholung beendet | 復習完了 |
| `roots.score` | {n} of {total} correct | 答对 {n} / {total} | {n} bonnes réponses sur {total} | {n} von {total} richtig | {total} 問中 {n} 問正解 |
| `roots.noDue` | Nothing is due right now. | 现在没有到期项。 | Rien à revoir pour le moment. | Momentan ist nichts fällig. | 今は復習する項目がありません。 |
| `roots.spellNote` | Root: {root} — {meaning} | 核心词根：{root}——{meaning} | Racine : {root} — {meaning} | Wurzel: {root} — {meaning} | 語根：{root} — {meaning} |
| `roots.reset` | Reset root progress | 重置词根进度 | Réinitialiser les racines | Wurzelfortschritt zurücksetzen | 語根の進捗をリセット |
| `roots.resetConfirm` | Reset all root mastery? Word history is not deleted. | 重置全部词根掌握度？历史记录不会被删除。 | Réinitialiser toute la maîtrise ? L’historique reste intact. | Gesamten Wurzelfortschritt zurücksetzen? Der Verlauf bleibt erhalten. | すべての語根の習得度をリセットしますか？履歴は残ります。 |
| `roots.resetDone` | Root progress reset. | 词根进度已重置。 | Progression des racines réinitialisée. | Wurzelfortschritt zurückgesetzt. | 語根の進捗をリセットしました。 |
| `profile.section.roots` | Roots & surprise | 词根与随机词 | Racines et hasard | Wurzeln & Überraschung | 語根とおまかせ |
| `profile.poolStats` | Surprise pool: {ready} of {total} words ready | 随机词池：{total} 个中还有 {ready} 个可用 | Réserve Au hasard : {ready} mots prêts sur {total} | Überraschungsvorrat: {ready} von {total} Wörtern bereit | おまかせ語彙：{total} 語中 {ready} 語が利用可能 |
| `discovery.core` | Core meaning | 核心义 | Sens central | Kernbedeutung | 核心義 |
| `discovery.examples` | Examples | 例句 | Exemples | Beispiele | 例文 |
| `discovery.rootNote` | Root note | 词根注 | Note de racine | Wurzelnotiz | 語根メモ |
| `discovery.bookOnly` | This word lives only in the Surprise me wordbook and cannot be used for spelling practice. | 这个词只保存在「随便看看」单词本，不参与拼写练习。 | Ce mot reste dans le carnet Au hasard et ne peut pas servir à l’orthographe. | Dieses Wort bleibt im Überraschungsheft und ist nicht für die Rechtschreibung verfügbar. | この語は「おまかせ」単語帳だけに保存され、綴り練習には使えません。 |
| `entry.saveFailed` | Could not save this entry. | 这条词条保存失败。 | Impossible d’enregistrer cette entrée. | Dieser Eintrag konnte nicht gespeichert werden. | この項目を保存できませんでした。 |
| `date.today` | Today | 今天 | Aujourd'hui | Heute | 今日 |
| `date.yesterday` | Yesterday | 昨天 | Hier | Gestern | 昨日 |
| `date.now` | just now | 刚刚 | à l'instant | gerade eben | たった今 |
| `date.minutes` | {n}m ago | {n} 分钟前 | il y a {n} min | vor {n} Min. | {n} 分前 |
| `date.hours` | {n}h ago | {n} 小时前 | il y a {n} h | vor {n} Std. | {n} 時間前 |
| `common.undo` | Undo | 撤销 | Annuler | Rückgängig | 元に戻す |
| `common.cancel` | Cancel | 取消 | Annuler | Abbrechen | キャンセル |
| `common.retry` | Try again | 重试 | Réessayer | Nochmal | もう一度 |
| `common.back` | Back | 返回 | Retour | Zurück | 戻る |
| `common.generate` | Generate | 生成 | Générer | Erzeugen | 生成する |
| `mode.auto` | Auto | 自动 | Auto | Auto | 自動 |
| `mode.word` | Word | 词 | Mot | Wort | 単語 |
| `mode.sentence` | Sentence | 句 | Phrase | Satz | 文 |
| `dict.language` | Language | 语言 | Langue | Sprache | 言語 |
| `dict.language.autoNote` | Identify it from the text | 由文本自动判断 | Déterminée à partir du texte | Wird aus dem Text erkannt | 入力したテキストから判定します |
| `dict.search.placeholder` | Word, phrase or sentence | 单词、短语或句子 | Un mot, une expression ou une phrase | Wort, Wendung oder Satz | 単語・成句・文 |
| `dict.search.placeholder.sentence` | Paste a sentence to analyse | 粘贴一个句子来分析 | Collez une phrase à analyser | Satz zum Analysieren einfügen | 分析したい文を貼り付けてください |
| `dict.search.label` | Look up | 查询 | Chercher | Nachschlagen | 調べる |
| `dict.surprise` | Surprise me | 随便看看 | Au hasard | Überrasch mich | おまかせ |
| `dict.surprise.thinking` | Thinking… | 正在想… | Recherche… | Denke nach… | 考えています… |
| `dict.surprise.empty` | Could not think of one — try again. | 没想到合适的，再试一次。 | Rien trouvé — réessayez. | Nichts gefunden — versuch es nochmal. | 見つかりませんでした。もう一度お試しください。 |
| `dict.surprise.repeat` | Still repeating itself — try again in a moment. | 又是老面孔，过一会儿再试。 | Encore un mot déjà proposé — réessayez dans un instant. | Schon wieder ein bekanntes Wort — gleich nochmal. | また同じ語でした。少し待ってからお試しください。 |
| `dict.surprise.picked` | Picked {word} · {lang} | 为你挑了 {word} · {lang} | Mot choisi : {word} · {lang} | Ausgesucht: {word} · {lang} | 選んだのは {word} · {lang} |
| `dict.candidates.empty` | No close match was found. Try the exact spelling, or switch the language. | 没有找到接近的词。可以试试准确拼写，或换一种语言。 | Aucune correspondance proche. Essayez l'orthographe exacte ou changez de langue. | Kein ähnlicher Treffer. Versuche die genaue Schreibweise oder wechsle die Sprache. | 近い候補は見つかりませんでした。正確な綴りを試すか、言語を切り替えてください。 |
| `dict.history.noMatch` | Nothing matches | 没有匹配项 | Aucun résultat | Kein Treffer | 一致する項目はありません |
| `error.showRaw` | Show raw answer | 查看原始返回 | Afficher la réponse brute | Rohantwort anzeigen | 生の応答を表示 |
| `dict.history.title` | History | 历史记录 | Historique | Verlauf | 履歴 |
| `dict.history.collapseAll` | Collapse all | 全部收起 | Tout replier | Alle zuklappen | すべてたたむ |
| `dict.history.expandAll` | Expand all | 全部展开 | Tout déplier | Alle aufklappen | すべて開く |
| `dict.history.search` | Search history | 搜索历史记录 | Rechercher dans l'historique | Verlauf durchsuchen | 履歴を検索 |
| `dict.history.matches` | {n} matches | {n} 条匹配 | {n} résultats | {n} Treffer | {n} 件 |
| `dict.history.match` | {n} match | {n} 条匹配 | {n} résultat | {n} Treffer | {n} 件 |
| `dict.history.emptyTitle` | Nothing here yet | 还没有记录 | Rien pour le moment | Noch nichts hier | まだ何もありません |
| `dict.history.emptyText` | Look up a word, or paste a sentence. Star the ones worth keeping — they move to Starred. | 查一个词，或粘贴一个句子。值得留下的加星标——它会进入星标。 | Cherchez un mot ou collez une phrase. Mettez une étoile à ce qui vaut la peine d'être gardé : cela part dans les favoris. | Schlag ein Wort nach oder füge einen Satz ein. Markiere mit dem Stern, was bleiben soll — es wandert zu den Favoriten. | 単語を調べるか、文を貼り付けてください。残しておきたいものに星を付けると、お気に入りに入ります。 |
| `dict.history.noMatchTitle` | Nothing matches | 没有匹配 | Aucun résultat | Kein Treffer | 見つかりません |
| `dict.history.noMatchText` | No history entry contains “{query}”. | 历史记录里没有含“{query}”的条目。 | Aucune entrée de l'historique ne contient « {query} ». | Kein Eintrag im Verlauf enthält „{query}“. | 「{query}」を含む履歴はありません。 |
| `dict.history.star` | Star | 星标 | Étoile | Stern | 星 |
| `dict.badge.sentence` | Sentence | 句子 | Phrase | Satz | 文 |
| `dict.key.title` | Add your DeepSeek API key to begin | 填入你的 DeepSeek API Key 即可开始 | Ajoutez votre clé API DeepSeek pour commencer | DeepSeek-API-Schlüssel eintragen und loslegen | DeepSeek の API キーを入れると使えます |
| `dict.key.text` | {app} keeps every answer on this device only. Your key is never sent anywhere except api.deepseek.com. | {app} 把所有答案只保存在这台设备上。你的 Key 除了 api.deepseek.com，不会发往任何地方。 | {app} garde toutes les réponses sur cet appareil. Votre clé n'est jamais envoyée ailleurs qu'à api.deepseek.com. | {app} behält jede Antwort nur auf diesem Gerät. Dein Schlüssel geht nirgendwohin außer an api.deepseek.com. | {app} はすべての答えをこの端末だけに保存します。キーは api.deepseek.com 以外へは送りません。 |
| `dict.key.placeholder` | sk-… | sk-… | sk-… | sk-… | sk-… |
| `dict.key.label` | DeepSeek API key | DeepSeek API Key | Clé API DeepSeek | DeepSeek-API-Schlüssel | DeepSeek API キー |
| `dict.key.save` | Save key | 保存 | Enregistrer | Speichern | 保存 |
| `dict.key.hint` | Stored in this browser only. | 只保存在本机浏览器。 | Stockée dans ce navigateur uniquement. | Nur in diesem Browser gespeichert. | このブラウザーにだけ保存します。 |
| `dict.key.more` | More settings | 更多设置 | Plus de réglages | Weitere Einstellungen | ほかの設定 |
| `dict.key.empty` | Paste your DeepSeek API key first. | 请先粘贴 DeepSeek API Key。 | Collez d'abord votre clé API DeepSeek. | Füge zuerst deinen DeepSeek-Schlüssel ein. | 先に DeepSeek の API キーを貼り付けてください。 |
| `dict.key.saved` | Key saved | 已保存 | Clé enregistrée | Schlüssel gespeichert | 保存しました |
| `dict.candidates.title` | Looking for the word behind “{input}”? | 想找的是“{input}”背后的哪个词？ | Quel mot cherchiez-vous derrière « {input} » ? | Welches Wort hinter „{input}“ suchst du? | 「{input}」で探している語はどれですか |
| `dict.candidates.accentTitle` | Did you mean one of these? | 是不是这几个？ | Vouliez-vous dire… ? | Meintest du eines davon? | もしかしてこの語ですか |
| `dict.candidates.typed` | you typed this | 你输入的就是这个 | c'est ce que vous avez tapé | das hast du getippt | 入力したのはこれ |
| `dict.candidates.cancel` | Cancel | 取消 | Annuler | Abbrechen | キャンセル |
| `validation.empty` | Type something to look up. | 请输入要查的内容。 | Saisissez quelque chose à chercher. | Gib etwas zum Nachschlagen ein. | 調べたい語を入力してください。 |
| `validation.sentenceTooLong` | Keep it under {n} characters. | 请控制在 {n} 字以内。 | Restez sous {n} caractères. | Bleib unter {n} Zeichen. | {n} 文字以内にしてください。 |
| `validation.wordTooLong` | Keep it under {n} characters. | 请控制在 {n} 字以内。 | Restez sous {n} caractères. | Bleib unter {n} Zeichen. | {n} 文字以内にしてください。 |
| `validation.expression` | Enter a single word or a short fixed expression. | 请输入一个词或一条固定表达。 | Saisissez un mot ou une courte expression figée. | Gib ein einzelnes Wort oder eine feste Wendung ein. | 単語か短い成句を入力してください。 |
| `entry.explainIn` | Explain in | 解释语言 | Explication en | Erklärung auf | 説明の言語 |
| `entry.collapseAll` | Collapse all | 全部收起 | Tout replier | Alle zuklappen | すべてたたむ |
| `entry.expandAll` | Expand all | 全部展开 | Tout déplier | Alle aufklappen | すべて開く |
| `entry.pronounce` | Pronounce | 发音 | Prononcer | Aussprechen | 発音 |
| `entry.practise` | Practise this word | 练习这个词 | Travailler ce mot | Dieses Wort üben | この語を練習 |
| `entry.practiseUnavailable` | This entry has no reading to practise | 这个词条没有读音，无法练习 | Cette entrée n’a pas de prononciation à travailler | Dieser Eintrag hat keine Lautung zum Üben | この項目には練習できる読みがありません |
| `entry.star` | Star | 星标 | Étoile | Stern | 星 |
| `entry.regenerate` | Regenerate | 重新生成 | Régénérer | Neu erzeugen | 再生成 |
| `entry.delete` | Delete | 删除 | Supprimer | Löschen | 削除 |
| `entry.addedStarred` | Added to Starred | 已加入星标 | Ajouté aux favoris | Zu den Favoriten hinzugefügt | お気に入りに追加しました |
| `entry.removedStarred` | Removed from Starred | 已移出星标 | Retiré des favoris | Aus den Favoriten entfernt | お気に入りから外しました |
| `entry.deleted` | Entry deleted | 词条已删除 | Entrée supprimée | Eintrag gelöscht | 項目を削除しました |
| `entry.restored` | Restored | 已恢复 | Restaurée | Wiederhergestellt | 元に戻しました |
| `entry.regenerating` | Re-generating in {lang} · up to 5 requests | 正在用{lang}重新生成 · 最多 5 次请求 | Nouvelle génération en {lang} · jusqu’à 5 requêtes | Wird auf {lang} neu erzeugt · bis zu 5 Anfragen | {lang}で再生成しています · 最大 5 リクエスト |
| `entry.notOnDeviceTitle` | Entry not on this device | 本机没有这个词条 | Entrée absente de cet appareil | Eintrag nicht auf diesem Gerät | この端末に項目がありません |
| `entry.notOnDeviceText` | Linguist stores answers locally, so this link only works where the lookup happened. | Linguist 把答案存在本地，这个链接只能在当初查询的设备上打开。 | Linguist garde les réponses en local : ce lien ne fonctionne que là où la recherche a eu lieu. | Linguist speichert Antworten lokal — dieser Link funktioniert nur dort, wo nachgeschlagen wurde. | Linguist は答えを端末内に保存します。このリンクは、調べたことのある端末でだけ開けます。 |
| `entry.storageTitle` | Storage is full | 存储空间已满 | Stockage plein | Speicher voll | 保存領域が一杯です |
| `entry.storageText` | This answer could not be saved in this browser, so it is not in your history and will be gone after a reload. Free space in Profile → Storage. | 这个答案没能存进浏览器，因此不在历史记录里，刷新后就会消失。可在「个人 → 存储」里清理空间。 | Cette réponse n'a pas pu être enregistrée dans ce navigateur : elle n'est pas dans votre historique et disparaîtra au rechargement. Libérez de la place dans Profil → Stockage. | Diese Antwort ließ sich in diesem Browser nicht speichern. Sie steht nicht im Verlauf und ist nach dem Neuladen weg. Schaffe Platz unter Profil → Speicher. | この答えはブラウザーに保存できませんでした。履歴にも残らず、再読み込みで消えます。「個人 → 保存領域」で空きを作ってください。 |
| `entry.pendingTitle` | {section} not generated yet | {section}尚未生成 | {section} pas encore généré | {section} noch nicht erzeugt | {section}はまだ生成されていません |
| `entry.pendingText` | This entry was saved before that section finished. | 保存这个词条时，该部分还没生成完。 | Cette entrée a été enregistrée avant que cette partie soit prête. | Dieser Eintrag wurde gespeichert, bevor dieser Teil fertig war. | この項目を保存したとき、この部分はまだ生成中でした。 |
| `entry.formsExpand` | Expand all forms | 展开全部形态 | Déplier toutes les formes | Alle Formen aufklappen | 活用形をすべて開く |
| `entry.formsCollapse` | Collapse all forms | 收起全部形态 | Replier toutes les formes | Alle Formen zuklappen | 活用形をすべてたたむ |
| `entry.formsCount` | {n} forms | {n} 个形式 | {n} formes | {n} Formen | {n} 形 |
| `entry.paradigmIrregular` | Irregular | 不规则 | Irrégulier | Unregelmäßig | 不規則 |
| `entry.endings` | Endings | 词尾 | Terminaisons | Endungen | 語尾 |
| `entry.watchOut` | Watch out | 注意 | Attention | Aufpassen | 注意 |
| `entry.memorise` | Must memorise | 必须记住 | À mémoriser | Muss man sich merken | 覚えるべきこと |
| `entry.rootVariants` | Root variants | 词根变体 | Variantes de la racine | Wurzelvarianten | 語根の異形 |
| `entry.directDerivatives` | Direct derivatives | 直接派生 | Dérivés directs | Direkte Ableitungen | 直接の派生語 |
| `entry.sharedRoot` | Shared root | 同源词 | Même racine | Gleiche Wurzel | 同じ語根 |
| `entry.sameIdea` | Same idea, different word | 同义不同词 | Même idée, autre mot | Gleiche Idee, anderes Wort | 同じ意味、別の語 |
| `entry.easilyMixed` | Easily mixed | 容易混淆 | À ne pas confondre | Leicht zu verwechseln | 混同しやすい |
| `entry.extendedSenses` | Extended senses | 引申义项 | Sens étendus | Erweiterte Bedeutungen | 派生した語義 |
| `entry.slots` | Slots | 可替换成分 | Emplacements | Einsetzbare Teile | 入れ替えられる部分 |
| `entry.disclaimer` | AI-generated. Etymology is scholarly consensus, not gospel — double-check before quoting it. | 由 AI 生成。词源部分取学界共识，不是定论——引用前请再核对一次。 | Contenu généré par IA. L'étymologie reflète un consensus savant, pas une vérité révélée — vérifiez avant de la citer. | Von KI erzeugt. Die Etymologie gibt den Forschungsstand wieder, nicht die Wahrheit — prüfe sie, bevor du sie zitierst. | AI による生成です。語源は学界の通説であり、定説ではありません。引用する前に確認してください。 |
| `entry.notFoundTitle` | No entry for that | 查不到这个词 | Aucune entrée trouvée | Kein Eintrag gefunden | 見つかりませんでした |
| `entry.notFoundText` | “{word}” is not a word or fixed expression in this language. Check the spelling, or switch the language. | “{word}”不是这种语言的词或固定表达。请检查拼写，或换一种语言。 | « {word} » n’est pas un mot ni une expression figée dans cette langue. Vérifiez l’orthographe ou changez de langue. | „{word}“ ist kein Wort und keine feste Wendung dieser Sprache. Prüfe die Schreibweise oder wechsle die Sprache. | 「{word}」はこの言語の単語でも成句でもありません。綴りを確かめるか、言語を切り替えてください。 |
| `group.dna` | Word DNA | 词根 DNA | ADN du mot | Wort-DNA | 語の DNA |
| `group.meaning` | Meaning | 释义 | Sens | Bedeutung | 意味 |
| `group.forms` | Forms | 形态 | Formes | Formen | 形態 |
| `group.context` | Context | 语境 | Contexte | Kontext | 背景 |
| `group.sentenceMeaning` | Meaning | 释义 | Sens | Bedeutung | 意味 |
| `group.grammar` | Grammar | 语法 | Grammaire | Grammatik | 文法 |
| `fav.title` | Starred | 星标 | Favoris | Favoriten | お気に入り |
| `fav.source` | Practice source | 练习来源 | Source des exercices | Übungsquelle | 練習の出典 |
| `fav.source.all` | All Starred ({n}) | 全部星标（{n}） | Tous les favoris ({n}) | Alle Favoriten ({n}) | お気に入り全体（{n}） |
| `fav.practise` | Practise | 练习 | S'exercer | Üben | 練習 |
| `fav.practiseUnavailable` | No reading to practise | 没有读音可练 | Pas de prononciation à travailler | Keine Lautung zum Üben | 練習できる読みがありません |
| `fav.rename` | Rename | 重命名 | Renommer | Umbenennen | 名前を変更 |
| `fav.delete` | Delete | 删除 | Supprimer | Löschen | 削除 |
| `fav.wordbooks` | Wordbooks | 单词本 | Carnets | Wortlisten | 単語帳 |
| `fav.books.title` | Wordbooks | 单词本 | Carnets | Wortlisten | 単語帳 |
| `fav.remove` | Remove from Starred | 移出星标 | Retirer des favoris | Aus den Favoriten entfernen | お気に入りから外す |
| `fav.emptyTitle` | Nothing here yet | 这里还没有内容 | Rien pour le moment | Noch nichts hier | まだ何もありません |
| `fav.emptyText` | Star a word while looking it up and it lands here, grouped by language. Then build wordbooks from it. | 查词时把值得留的加星标，它就会出现在这里，并按语言分组。之后可以再建单词本。 | Mettez une étoile à un mot pendant la recherche : il arrive ici, classé par langue. Vous pourrez ensuite créer des carnets. | Markiere beim Nachschlagen ein Wort mit dem Stern: es landet hier, nach Sprache sortiert. Daraus lassen sich Wortlisten bauen. | 調べた語に星を付けると、ここに言語ごとに並びます。そこから単語帳を作れます。 |
| `fav.emptyAction` | Back to Dictionary | 回到词典 | Retour au dictionnaire | Zurück zum Wörterbuch | 辞書に戻る |
| `fav.newBook` | New wordbook | 新建单词本 | Nouveau carnet | Neue Wortliste | 新しい単語帳 |
| `fav.newBookHint` | Group starred words however you like — a word can sit in several | 想怎么归类都行——一个词可以同时属于几个单词本 | Rangez vos favoris comme vous voulez — un mot peut être dans plusieurs | Sortiere Favoriten wie du willst — ein Wort darf in mehreren stehen | 自由にまとめてください。一つの語を複数の単語帳に入れられます |
| `fav.bookPrompt` | Name this wordbook | 给这个单词本起个名字 | Nom du carnet | Name der Wortliste | 単語帳の名前 |
| `fav.bookCreated` | Created “{name}” | 已创建“{name}” | Carnet « {name} » créé | „{name}“ angelegt | 「{name}」を作成しました |
| `fav.bookFailed` | Could not create that wordbook. | 没能创建单词本。 | Impossible de créer ce carnet. | Die Wortliste ließ sich nicht anlegen. | 単語帳を作成できませんでした。 |
| `fav.bookRenamed` | Renamed | 已重命名 | Renommé | Umbenannt | 名前を変更しました |
| `fav.bookDeleted` | Wordbook deleted | 单词本已删除 | Carnet supprimé | Wortliste gelöscht | 単語帳を削除しました |
| `fav.bookConfirm` | Delete “{name}”? The words stay in Starred. | 删除“{name}”？其中的词仍留在星标里。 | Supprimer « {name} » ? Les mots restent dans les favoris. | „{name}“ löschen? Die Wörter bleiben in den Favoriten. | 「{name}」を削除しますか？ 語はお気に入りに残ります。 |
| `fav.removed` | Removed from Starred | 已移出星标 | Retiré des favoris | Aus den Favoriten entfernt | お気に入りから外しました |
| `fav.words` | Words | 单词 | Mots | Wörter | 単語 |
| `fav.noWordbooks` | No wordbooks yet. | 还没有单词本。 | Aucun carnet pour l'instant. | Noch keine Vokabelhefte. | 単語帳はまだありません。 |
| `fav.newBookInline` | + New wordbook | ＋ 新建单词本 | + Nouveau carnet | + Neues Vokabelheft | ＋ 単語帳を作る |
| `fav.sentences` | Sentences | 句子 | Phrases | Sätze | 文 |
| `fav.documents` | Files | 文件 | Fichiers | Dateien | ファイル |
| `fav.retired` | retired | 已停用 | retirée | stillgelegt | 提供終了 |
| `fav.unknown` | Language unknown | 语言未知 | Langue inconnue | Sprache unbekannt | 言語が不明 |
| `fav.unknownText` | These were saved before Linguist recorded a language. Identifying them asks about a few at a time. | 这些词条保存时还没记录语言。识别会一次问几个。 | Ces entrées ont été enregistrées avant que Linguist note la langue. L'identification en demande quelques-unes à la fois. | Diese Einträge entstanden, bevor Linguist die Sprache notierte. Die Erkennung fragt jeweils ein paar auf einmal. | これらは言語が記録される前に保存されたものです。判定は数件ずつ行います。 |
| `fav.unknownNeedKey` | Add an API key and these can be identified. | 填入 API Key 后即可识别。 | Ajoutez une clé API et elles pourront être identifiées. | Mit einem API-Schlüssel lassen sie sich erkennen. | API キーを入れると判定できます。 |
| `fav.identifyOne` | Identify | 识别 | Identifier | Erkennen | 判定する |
| `fav.identifyMany` | Identify {n} of {total} | 识别 {total} 个中的 {n} 个 | Identifier {n} sur {total} | {n} von {total} erkennen | {total} 件のうち {n} 件を判定 |
| `fav.identifying` | Identifying… | 正在识别… | Identification… | Erkenne… | 判定しています… |
| `fav.identified` | Identified {n} | 已识别 {n} 个 | {n} identifiées | {n} erkannt | {n} 件を判定しました |
| `fav.notIdentified` | Still could not tell | 还是认不出来 | Toujours impossible à déterminer | Immer noch nicht zu bestimmen | やはり分かりませんでした |
| `fav.filedUnder` | Filed under {lang} | 已归入 {lang} | Classé en {lang} | Einsortiert unter {lang} | {lang}に入れました |
| `fav.needKey` | Add an API key in Profile first | 请先在「个人」里填入 API Key | Ajoutez d'abord une clé API dans le profil | Trag zuerst im Profil einen API-Schlüssel ein | 先に「個人」で API キーを入れてください |
| `fav.practiceNone` | Nothing here to practise yet. | 这里还没有可练习的内容。 | Rien à travailler ici pour l'instant. | Hier gibt es noch nichts zu üben. | まだ練習できるものがありません。 |
| `fav.practiceNoReading` | Nothing in this source can be practised yet — Chinese and Japanese words need a reading. | 这个来源里还没有能练的——中文和日文需要读音。 | Rien de travaillable dans cette source : le chinois et le japonais ont besoin d’une prononciation. | In dieser Quelle ist noch nichts übbar — Chinesisch und Japanisch brauchen eine Lautung. | この範囲にはまだ練習できるものがありません。中国語と日本語には読みが必要です。 |
| `practice.title` | Practice | 练习 | Exercice | Übung | 練習 |
| `practice.star` | Star | 星标 | Étoile | Stern | 星 |
| `practice.replay` | Replay | 重播 | Réécouter | Nochmal hören | もう一度聞く |
| `practice.close` | Close | 关闭 | Fermer | Schließen | 閉じる |
| `practice.exit` | Exit practice | 退出练习 | Quitter l'exercice | Übung beenden | 練習をやめる |
| `practice.hint` | Hint | 提示 | Indice | Tipp | ヒント |
| `practice.skip` | Skip | 跳过 | Passer | Überspringen | スキップ |
| `practice.startsWith` | starts with “{char}” | 以「{char}」开头 | commence par « {char} » | beginnt mit „{char}“ | 「{char}」で始まる |
| `practice.toneHint` | Tones {tones} | 声调 {tones} | Tons {tones} | Töne {tones} | 声調 {tones} |
| `practice.moraHint` | {n} mora | {n} 拍 | {n} mores | {n} Moren | {n} 拍 |
| `practice.check` | Check | 检查 | Vérifier | Prüfen | 確認 |
| `practice.retry` | Retry | 重做 | Reprendre | Nochmal | やり直す |
| `practice.input` | Type your answer | 输入答案 | Tapez votre réponse | Antwort eingeben | 答えを入力 |
| `practice.tone` | Reading correct — mind the tone: {answer} | 读音正确，注意声调：{answer} | Lecture correcte — attention au ton : {answer} | Lautung stimmt — achte auf den Ton: {answer} | 読みは合っています。声調に注意：{answer} |
| `practice.okurigana` | The okurigana is off: {answer} | 送假名不对：{answer} | L'okurigana ne va pas : {answer} | Die Okurigana stimmen nicht: {answer} | 送り仮名が違います：{answer} |
| `practice.alsoRead` | Also read: {readings} | 其他读音：{readings} | Se lit aussi : {readings} | Auch lesbar als: {readings} | ほかの読み：{readings} |
| `profile.section.account` | Account | 账号 | Compte | Konto | アカウント |
| `profile.section.key` | DeepSeek API key | DeepSeek API Key | Clé API DeepSeek | DeepSeek-API-Schlüssel | DeepSeek API キー |
| `profile.section.model` | Model | 模型 | Modèle | Modell | モデル |
| `profile.section.explanation` | Explanation language | 解释语言 | Langue d'explication | Erklärungssprache | 説明の言語 |
| `profile.section.appearance` | Appearance | 外观 | Apparence | Darstellung | 表示 |
| `profile.section.storage` | Storage | 存储 | Stockage | Speicher | 保存領域 |
| `profile.section.backup` | Backup | 备份 | Sauvegarde | Sicherung | バックアップ |
| `profile.section.reset` | Reset | 重置 | Réinitialiser | Zurücksetzen | リセット |
| `profile.section.about` | About | 关于 | À propos | Über | このアプリについて |
| `profile.device.title` | This device | 本机 | Cet appareil | Dieses Gerät | この端末 |
| `profile.device.text` | Answers and settings stay in this browser. No account is created. | 答案与设置都留在这个浏览器里，不创建任何账号。 | Réponses et réglages restent dans ce navigateur. Aucun compte n'est créé. | Antworten und Einstellungen bleiben in diesem Browser. Es wird kein Konto angelegt. | 答えも設定もこのブラウザーの中だけに残ります。アカウントは作りません。 |
| `profile.history.title` | History | 历史记录 | Historique | Verlauf | 履歴 |
| `profile.history.sub` | {n} entries · {m} starred | {n} 条 · {m} 条星标 | {n} entrées · {m} en favoris | {n} Einträge · {m} mit Stern | {n} 件 · 星 {m} 件 |
| `profile.storageUnavailable.title` | Storage is unavailable | 存储不可用 | Stockage indisponible | Speicher nicht verfügbar | 保存領域が使えません |
| `profile.storageUnavailable.text` | This browser blocks local storage, so nothing will survive a reload. | 这个浏览器禁用了本地存储，刷新后什么都不会留下。 | Ce navigateur bloque le stockage local : rien ne survivra à un rechargement. | Dieser Browser blockiert lokalen Speicher — nach dem Neuladen ist nichts mehr da. | このブラウザーはローカル保存を禁じています。再読み込みで何も残りません。 |
| `profile.noKey.title` | Add a key to start | 填入 Key 才能开始 | Ajoutez une clé pour commencer | Schlüssel eintragen, dann geht es los | キーを入れると始められます |
| `profile.noKey.text` | Linguist only works once your own DeepSeek API key is in place. | 只有填好你自己的 DeepSeek API Key，Linguist 才能工作。 | Linguist ne fonctionne qu'avec votre propre clé API DeepSeek. | Linguist arbeitet nur mit deinem eigenen DeepSeek-Schlüssel. | ご自身の DeepSeek API キーがないと Linguist は動きません。 |
| `profile.install` | Install app | 安装应用 | Installer l'application | App installieren | アプリをインストール |
| `profile.install.offline` | Not available in the offline single-file build. | 离线单文件版不支持安装。 | Indisponible dans la version hors ligne en un seul fichier. | In der Einzeldatei-Version offline nicht möglich. | オフライン単一ファイル版では使えません。 |
| `profile.install.installed` | Running as an installed app. | 正以已安装应用的方式运行。 | Fonctionne comme application installée. | Läuft als installierte App. | インストール済みアプリとして動作中です。 |
| `profile.install.chip` | installed | 已安装 | installée | installiert | インストール済み |
| `profile.install.ios` | Tap Share in Safari, then “Add to Home Screen”. | 在 Safari 里点“分享”，再选“添加到主屏幕”。 | Touchez Partager dans Safari, puis « Sur l’écran d’accueil ». | Tippe in Safari auf Teilen, dann „Zum Home-Bildschirm“. | Safari で共有をタップし、「ホーム画面に追加」を選びます。 |
| `profile.install.needsHttps` | Installation needs an https address. Open the hosted version to install. | 安装需要 https 地址，请打开在线版再安装。 | L'installation exige une adresse https. Ouvrez la version hébergée pour installer. | Zum Installieren braucht es eine https-Adresse. Öffne die gehostete Version. | インストールには https のアドレスが必要です。公開版を開いてください。 |
| `profile.install.menu` | Use your browser menu: Install app, or Add to Home Screen. | 用浏览器菜单里的“安装应用”或“添加到主屏幕”。 | Passez par le menu du navigateur : Installer, ou Ajouter à l'écran d'accueil. | Nimm das Browsermenü: App installieren oder Zum Home-Bildschirm. | ブラウザーのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。 |
| `profile.key.placeholder` | sk-... | sk-... | sk-... | sk-... | sk-... |
| `profile.key.hint` | Stored as plain text in this browser only. Get a key at  | 以明文只保存在本机浏览器。Key 可在  | Stockée en clair dans ce navigateur uniquement. Obtenez une clé sur  | Nur in diesem Browser im Klartext gespeichert. Einen Schlüssel gibt es bei  | このブラウザーに平文で保存されます。キーはこちらで取得できます： |
| `profile.key.testing` | Contacting DeepSeek… | 正在连接 DeepSeek… | Connexion à DeepSeek… | Verbinde mit DeepSeek… | DeepSeek に接続しています… |
| `profile.key.saved` | Key saved | 已保存 | Clé enregistrée | Schlüssel gespeichert | 保存しました |
| `profile.key.cleared` | Key cleared | 已清除 | Clé effacée | Schlüssel gelöscht | キーを消しました |
| `profile.explanation.hint` | Each row is the language a word of that language is explained in. An entry keeps whatever it was generated with; changing a row affects the next lookup. | 每行是「这种语言的词，用哪种语言解释」。已生成的词条保持原样，改这里只影响以后的查询。 | Chaque ligne dit dans quelle langue s'explique un mot de cette langue. Une entrée déjà générée ne change pas : cela vaut pour les recherches suivantes. | Jede Zeile sagt, in welcher Sprache ein Wort dieser Sprache erklärt wird. Ein bereits erzeugter Eintrag bleibt, wie er ist; geändert wird das nächste Nachschlagen. | 各行は「その言語の語をどの言語で説明するか」です。生成済みの項目はそのままで、次の検索から反映されます。 |
| `profile.uiLang` | Interface language | 界面语言 | Langue de l'interface | Sprache der Oberfläche | 画面の言語 |
| `profile.uiLang.auto` | Follow browser | 跟随浏览器 | Suivre le navigateur | Dem Browser folgen | ブラウザーに合わせる |
| `profile.uiLang.hint` | The interface and the explanations are independent: this changes the buttons and labels, not what the model writes. | 界面语言和解释语言是两条独立的轴：这里改的是按钮与标签，不是模型写出来的内容。 | Interface et explications sont indépendantes : ici on change les boutons et les libellés, pas ce qu’écrit le modèle. | Oberfläche und Erklärungen sind unabhängig: hier ändern sich Knöpfe und Beschriftungen, nicht das, was das Modell schreibt. | 画面の言語と説明の言語は別々です。ここで変わるのはボタンや見出しで、モデルが書く内容ではありません。 |
| `profile.appearance.hint` | Auto follows your system appearance. | “自动”跟随系统外观。 | « Auto » suit l'apparence du système. | „Auto“ folgt der Systemdarstellung. | 「自動」はシステムの外観に従います。 |
| `profile.storage.entries` | {n} stored | 已存 {n} 条 | {n} enregistrées | {n} gespeichert | {n} 件保存 |
| `profile.storage.unstarred` | {n} unstarred | {n} 条未加星标 | {n} sans étoile | {n} ohne Stern | {n} 件は星なし |
| `profile.storage.size` | about {size} used | 约占用 {size} | environ {size} utilisés | etwa {size} belegt | 約 {size} 使用 |
| `profile.storage.sizeUnknown` | size unavailable | 无法获知占用 | taille inconnue | Größe unbekannt | 使用量は不明 |
| `profile.storage.prune` | Prune old entries | 清理旧条目 | Élaguer les anciennes entrées | Alte Einträge ausdünnen | 古い項目を整理 |
| `profile.storage.pruneHint` | Keeps the newest 200 and everything starred | 保留最新 200 条与全部星标 | Garde les 200 plus récentes et tout ce qui a une étoile | Behält die neuesten 200 und alles mit Stern | 新しい 200 件と星付きはすべて残します |
| `profile.storage.hint` | Everything lives in this browser only. If it fills up, pruning drops the oldest entries you have not starred. | 所有内容都只在这个浏览器里。空间不够时，清理会从你没加星标的最旧条目开始删。 | Tout vit dans ce navigateur. En cas de saturation, l'élagage supprime les entrées les plus anciennes sans étoile. | Alles liegt nur in diesem Browser. Wird es eng, wirft das Ausdünnen die ältesten Einträge ohne Stern weg. | すべてこのブラウザーの中だけにあります。一杯になると、星を付けていない古い項目から整理します。 |
| `profile.storage.pruned` | Pruned {n} entries | 已清理 {n} 条 | {n} entrées élaguées | {n} Einträge ausgedünnt | {n} 件を整理しました |
| `profile.storage.pruneNone` | Nothing to prune | 没有可清理的 | Rien à élaguer | Nichts auszudünnen | 整理するものはありません |
| `profile.backup.export` | Export a JSON backup | 导出 JSON 备份 | Exporter une sauvegarde JSON | JSON-Sicherung exportieren | JSON バックアップを書き出す |
| `profile.backup.exportHint` | Everything except your API key | 除 API Key 之外的全部内容 | Tout sauf votre clé API | Alles außer dem API-Schlüssel | API キー以外のすべて |
| `profile.backup.import` | Import a backup | 导入备份 | Importer une sauvegarde | Sicherung importieren | バックアップを読み込む |
| `profile.backup.importHint` | Merges into what is already here | 与现有数据合并，不覆盖 | Fusionne avec ce qui s'y trouve déjà | Fügt zusammen, was schon da ist | いまある内容に統合します |
| `profile.backup.old` | Import from Linguist {version} | 从 Linguist {version} 导入 | Importer depuis Linguist {version} | Aus Linguist {version} importieren | Linguist {version} から読み込む |
| `profile.backup.oldHint` | Reads the older version once; it is never modified | 只读取旧版本一次，绝不修改它 | L'ancienne version est lue une fois, jamais modifiée | Liest die alte Version einmal, ändert sie nie | 古い版を一度読むだけで、書き換えません |
| `profile.backup.neverKey` | Backups never contain your API key. | 备份里永远不含 API Key。 | Les sauvegardes ne contiennent jamais votre clé API. | Sicherungen enthalten nie deinen API-Schlüssel. | バックアップに API キーは含まれません。 |
| `profile.backup.exported` | Backup exported | 已导出 | Sauvegarde exportée | Sicherung exportiert | 書き出しました |
| `profile.backup.exportFailed` | Export failed: {message} | 导出失败：{message} | Échec de l'export : {message} | Export fehlgeschlagen: {message} | 書き出しに失敗：{message} |
| `profile.backup.restored` | Restored {n} entries | 已恢复 {n} 条 | {n} entrées restaurées | {n} Einträge wiederhergestellt | {n} 件を復元しました |
| `profile.backup.importFailed` | Import failed: {message} | 导入失败：{message} | Échec de l'import : {message} | Import fehlgeschlagen: {message} | 読み込みに失敗：{message} |
| `profile.backup.readFailed` | Could not read that file | 读不了这个文件 | Impossible de lire ce fichier | Diese Datei ließ sich nicht lesen | このファイルを読めませんでした |
| `profile.import.confirm` | Import the data from Linguist {version}? It is only read, never changed. | 从 Linguist {version} 导入数据？只读，不会改动旧数据。 | Importer les données de Linguist {version} ? Elles sont seulement lues, jamais modifiées. | Daten aus Linguist {version} importieren? Sie werden nur gelesen, nie geändert. | Linguist {version} のデータを読み込みますか？ 読むだけで、変更はしません。 |
| `profile.import.imported` | Imported {n} entries | 已导入 {n} 条 | {n} entrées importées | {n} Einträge importiert | {n} 件を読み込みました |
| `profile.import.nothing` | Nothing new to import | 没有新内容可导入 | Rien de nouveau à importer | Nichts Neues zu importieren | 新しく読み込むものはありません |
| `profile.import.available` | Nothing to import | 没有可导入的数据 | Rien à importer | Nichts zu importieren | 読み込めるものがありません |
| `profile.reset.clearHistory` | Clear history | 清空历史记录 | Effacer l'historique | Verlauf löschen | 履歴を消す |
| `profile.reset.clearHistoryHint` | {n} unstarred entries are removed | 将删除 {n} 条未加星标的记录 | {n} entrées sans étoile seront supprimées | {n} Einträge ohne Stern werden entfernt | 星なしの {n} 件を削除します |
| `profile.reset.clearHistoryConfirm` | Delete every unstarred entry? Starred entries are kept. | 删除所有未加星标的词条？加星标的会保留。 | Supprimer toutes les entrées sans étoile ? Celles avec une étoile sont conservées. | Alle Einträge ohne Stern löschen? Einträge mit Stern bleiben. | 星なしの項目をすべて削除しますか？ 星付きは残ります。 |
| `profile.reset.historyCleared` | History cleared | 历史记录已清空 | Historique effacé | Verlauf gelöscht | 履歴を消しました |
| `profile.reset.clearStars` | Clear stars | 清空星标 | Retirer toutes les étoiles | Alle Sterne entfernen | 星をすべて外す |
| `profile.reset.clearStarsHint` | {n} starred entries stay in history; wordbooks are emptied | {n} 条星标记录留在历史里；单词本会被清空 | {n} entrées étoilées restent dans l’historique ; les carnets sont vidés | {n} Einträge mit Stern bleiben im Verlauf; Wortlisten werden geleert | 星付き {n} 件は履歴に残ります。単語帳は空になります |
| `profile.reset.clearStarsConfirm` | Remove every star? The entries stay in history, but your wordbooks will be emptied. | 清空全部星标？词条会留在历史记录里，但单词本会被清空。 | Retirer toutes les étoiles ? Les entrées restent dans l’historique, mais vos carnets seront vidés. | Alle Sterne entfernen? Die Einträge bleiben im Verlauf, deine Wortlisten werden aber geleert. | 星をすべて外しますか？ 項目は履歴に残りますが、単語帳は空になります。 |
| `profile.reset.starsCleared` | Stars cleared | 星标已清空 | Étoiles retirées | Sterne entfernt | 星を外しました |
| `profile.reset.clearCache` | Clear app cache and reload | 清除应用缓存并重载 | Vider le cache de l'application et recharger | App-Zwischenspeicher leeren und neu laden | アプリのキャッシュを消して再読み込み |
| `profile.reset.clearCacheHint` | Unregisters the service worker | 注销 Service Worker | Désenregistre le service worker | Meldet den Service Worker ab | Service Worker を解除します |
| `profile.reset.clearCacheConfirm` | Unregister the service worker and empty the cache, then reload? | 注销 Service Worker、清空缓存，然后重新加载？ | Désenregistrer le service worker, vider le cache, puis recharger ? | Service Worker abmelden, Zwischenspeicher leeren und neu laden? | Service Worker を解除し、キャッシュを消して再読み込みしますか？ |
| `profile.reset.clearCacheHint2` | Clearing the app cache is only needed when the hosted build keeps serving an older version after an update. | 只有在更新后在线版仍然返回旧外壳时，才需要清缓存。 | Vider le cache n'est utile que si la version hébergée sert encore une ancienne coquille après une mise à jour. | Das Leeren ist nur nötig, wenn die gehostete Version nach einem Update noch die alte Hülle ausliefert. | キャッシュを消すのは、更新後も公開版が古い画面を返すときだけ必要です。 |
| `profile.about.disclaimer` | Answers are generated by DeepSeek from your own key. They can be incomplete or wrong, etymology especially — treat them as a starting point, not a citation. | 答案由 DeepSeek 依据你自己的 Key 生成，可能不完整甚至出错，词源尤其如此——请当作起点，不要当作引证。 | Les réponses sont générées par DeepSeek avec votre clé. Elles peuvent être incomplètes ou fausses, l'étymologie surtout — prenez-les comme un point de départ, pas comme une citation. | Antworten erzeugt DeepSeek mit deinem Schlüssel. Sie können unvollständig oder falsch sein, die Etymologie besonders — nimm sie als Ausgangspunkt, nicht als Beleg. | 答えは DeepSeek がご自身のキーで生成します。不完全だったり誤っていたりすることがあり、とくに語源はそうです。出典ではなく出発点として扱ってください。 |
| `profile.model.set` | Model set to {model} | 模型已切换为 {model} | Modèle réglé sur {model} | Modell auf {model} gesetzt | モデルを {model} にしました |
| `profile.install.accepted` | Installing {app} | 正在安装 {app} | Installation de {app} | {app} wird installiert | {app} をインストールしています |
| `profile.install.dismissed` | Install dismissed | 已取消安装 | Installation annulée | Installation verworfen | インストールをやめました |
| `profile.install.unavailable` | Your browser did not offer an install prompt | 这个浏览器没有提供安装提示 | Votre navigateur n'a pas proposé d'installation | Dieser Browser hat keine Installation angeboten | このブラウザーはインストールを案内しませんでした |
| `profile.importFirstRun` | Linguist {version} data was found on this device. Import it into {app} {current}? The older data is read once and left untouched. | 本机发现了 Linguist {version} 的数据。要导入到 {app} {current} 吗？旧数据只读一次，不会被改动。 | Des données Linguist {version} ont été trouvées sur cet appareil. Les importer dans {app} {current} ? Les anciennes données sont lues une fois et laissées intactes. | Auf diesem Gerät liegen Daten von Linguist {version}. In {app} {current} importieren? Die alten Daten werden einmal gelesen und bleiben unangetastet. | この端末に Linguist {version} のデータがあります。{app} {current} に読み込みますか？ 古いデータは一度読むだけで、そのまま残ります。 |
| `error.lookupFailed` | Lookup failed | 查询失败 | Échec de la recherche | Nachschlagen fehlgeschlagen | 調べられませんでした |
| `error.noKey.title` | API key required | 需要 API Key | Clé API requise | API-Schlüssel nötig | API キーが必要です |
| `error.noKey.action` | Open Profile | 打开个人界面 | Ouvrir le profil | Profil öffnen | 個人を開く |
| `error.auth.title` | Invalid API key | API Key 无效 | Clé API invalide | API-Schlüssel ungültig | API キーが無効です |
| `error.auth.action` | Fix in Profile | 去个人界面修改 | Corriger dans le profil | Im Profil korrigieren | 個人で直す |
| `error.balance.title` | Insufficient balance | 余额不足 | Solde insuffisant | Guthaben reicht nicht | 残高が足りません |
| `error.rateLimit.title` | Rate limited | 请求过于频繁 | Trop de requêtes | Zu viele Anfragen | リクエストが集中しています |
| `error.timeout.title` | Request timed out | 请求超时 | Délai dépassé | Zeitüberschreitung | 応答がありませんでした |
| `error.offline.title` | You are offline | 当前处于离线状态 | Vous êtes hors ligne | Du bist offline | オフラインです |
| `error.network.title` | Network unreachable | 连不上网络 | Réseau injoignable | Netz nicht erreichbar | ネットワークに届きません |
| `error.badJson.title` | Unreadable answer | 返回内容无法解析 | Réponse illisible | Antwort unlesbar | 応答を読めません |
| `error.language.title` | Language unclear | 无法判断语言 | Langue indéterminée | Sprache unklar | 言語を判別できません |
| `error.generic` | Something went wrong. | 出了点问题。 | Quelque chose s'est mal passé. | Da ist etwas schiefgelaufen. | 問題が起きました。 |
| `error.kind.no_key` | No API key yet. Add your DeepSeek key in Profile to start looking words up. | 还没有 API Key。请到「个人」里填入 DeepSeek Key，然后就能查词了。 | Pas encore de clé API. Ajoutez votre clé DeepSeek dans le profil pour commencer à chercher. | Noch kein API-Schlüssel. Trag deinen DeepSeek-Schlüssel im Profil ein, dann kann es losgehen. | まだ API キーがありません。「個人」で DeepSeek のキーを入れると調べられます。 |
| `error.kind.auth` | DeepSeek rejected this API key. | DeepSeek 拒绝了这个 API Key。 | DeepSeek a refusé cette clé API. | DeepSeek hat diesen API-Schlüssel abgelehnt. | DeepSeek がこの API キーを拒否しました。 |
| `error.kind.balance` | This DeepSeek account is out of balance. | 这个 DeepSeek 账户余额不足。 | Ce compte DeepSeek est à court de crédit. | Dieses DeepSeek-Konto hat kein Guthaben mehr. | この DeepSeek アカウントは残高が足りません。 |
| `error.kind.rate_limit` | DeepSeek is rate limiting right now. | DeepSeek 正在限流。 | DeepSeek limite le débit en ce moment. | DeepSeek bremst gerade die Anfragen. | DeepSeek が現在レート制限中です。 |
| `error.kind.timeout` | The request took too long and was cancelled. | 请求时间过长，已取消。 | La requête a été trop longue et a été annulée. | Die Anfrage dauerte zu lang und wurde abgebrochen. | 時間がかかりすぎたため取り消しました。 |
| `error.kind.network` | Could not reach api.deepseek.com. | 连不上 api.deepseek.com。 | Impossible de joindre api.deepseek.com. | api.deepseek.com war nicht erreichbar. | api.deepseek.com に接続できません。 |
| `error.kind.server` | DeepSeek returned a server error. | DeepSeek 返回了服务器错误。 | DeepSeek a renvoyé une erreur serveur. | DeepSeek hat einen Serverfehler gemeldet. | DeepSeek がサーバーエラーを返しました。 |
| `error.kind.bad_json` | The answer came back unreadable. | 返回的内容读不出来。 | La réponse est illisible. | Die Antwort kam unlesbar zurück. | 応答の中身を読み取れません。 |
| `error.kind.offline` | You appear to be offline. | 你似乎离线了。 | Vous semblez hors ligne. | Du scheinst offline zu sein. | オフラインのようです。 |
| `error.kind.language` | The answer did not say which language this is. | 答案里没有说明这是哪种语言。 | La réponse n'indique pas de quelle langue il s'agit. | Die Antwort nennt nicht, um welche Sprache es geht. | どの言語なのかが答えに書かれていません。 |
| `error.kind.aborted` | The request was cancelled. | 请求已取消。 | La requête a été annulée. | Die Anfrage wurde abgebrochen. | リクエストを取り消しました。 |
| `tour.skip` | Skip | 跳过 | Passer | Überspringen | スキップ |
| `tour.back` | Back | 上一步 | Retour | Zurück | 戻る |
| `tour.next` | Next | 下一步 | Suivant | Weiter | 次へ |
| `tour.done` | Got it | 知道了 | Compris | Verstanden | わかりました |
| `tour.step` | {n} of {total} | 第 {n} / {total} 步 | {n} sur {total} | {n} von {total} | {total} のうち {n} |
| `tour.search.title` | Look anything up | 什么都能查 | Cherchez ce que vous voulez | Alles nachschlagen | 何でも調べられます |
| `tour.search.text` | A word, a short phrase, or a whole sentence. The type picker above decides which, and Auto works it out from what you type. | 一个词、一条短语，或一整句话都行。上面的类型选择器决定怎么处理，「自动」则由你输入的内容来定。 | Un mot, une courte expression ou une phrase entière. Le sélecteur de type décide, et « Auto » le déduit de votre saisie. | Ein Wort, eine kurze Wendung oder ein ganzer Satz. Die Auswahl darüber entscheidet, und „Auto“ leitet es aus deiner Eingabe ab. | 単語でも、短い成句でも、文全体でも。上の種類の選択が処理を決め、「自動」なら入力から判断します。 |
| `tour.type.title` | Word or sentence | 词还是句子 | Mot ou phrase | Wort oder Satz | 単語か文か |
| `tour.type.text` | Word gives you the full entry: meaning, roots, forms. Sentence analyses the grammar of one sentence. | 「词」给出完整词条：释义、词根、形态。「句」则分析一句话的语法。 | « Mot » donne la fiche complète : sens, racines, formes. « Phrase » analyse la grammaire d’une phrase. | „Wort“ gibt den ganzen Eintrag: Bedeutung, Wurzeln, Formen. „Satz“ analysiert die Grammatik eines Satzes. | 「単語」は意味・語根・形態まで含む項目全体を、「文」は一文の文法を扱います。 |
| `tour.lang.title` | Which language | 查哪种语言 | Quelle langue | Welche Sprache | どの言語か |
| `tour.lang.text` | Auto identifies it from the text. Pin one when you know it and want the answer to be certain. | 「自动」由文本判断。你已经确定时可以直接锁定，答案会更肯定。 | « Auto » la déduit du texte. Fixez-la quand vous la connaissez : la réponse sera plus sûre. | „Auto“ erkennt sie aus dem Text. Leg sie fest, wenn du sie kennst — dann wird die Antwort sicherer. | 「自動」はテキストから判定します。分かっているときは固定すると、答えがより確かになります。 |
| `tour.explain.title` | Explain in | 解释语言 | Explication en | Erklärung auf | 説明の言語 |
| `tour.explain.text` | Every entry is written in a language you choose — one row per source language, in Profile. This control switches the entry you are reading. | 每个词条用你指定的一种语言来写——在「个人」里每种源语言一行。这里改的是你正在读的这一条。 | Chaque fiche est écrite dans la langue que vous choisissez — une ligne par langue source, dans le profil. Ici, on change la fiche que vous lisez. | Jeder Eintrag wird in einer Sprache deiner Wahl geschrieben — eine Zeile je Ausgangssprache im Profil. Hier wechselst du den Eintrag, den du gerade liest. | 各項目は選んだ言語で書かれます。「個人」で元の言語ごとに一行ずつ決めます。ここで変わるのは、いま読んでいる項目だけです。 |
| `tour.surprise.title` | Surprise me | 随便看看 | Au hasard | Überrasch mich | おまかせ |
| `tour.surprise.text` | A word worth knowing, chosen for you. It never repeats one it has already offered. | 替你挑一个值得认识的词。已经给过的词不会再出现。 | Un mot qui vaut la peine d’être connu, choisi pour vous. Il ne reprend jamais un mot déjà proposé. | Ein Wort, das sich lohnt, für dich ausgesucht. Es wiederholt nie eines, das schon dran war. | 知っておく価値のある語を選びます。一度出した語は二度と出しません。 |
| `tour.tabs.title` | Three screens | 三个界面 | Trois écrans | Drei Bildschirme | 三つの画面 |
| `tour.tabs.text` | Look words up, keep the ones worth keeping, and set everything up. | 查词、留下值得留的、以及把一切设置好。 | Chercher des mots, garder ceux qui comptent, et tout régler. | Wörter nachschlagen, lohnende behalten und alles einrichten. | 語を調べる、残す価値のあるものを残す、そして全体を設定する。 |
| `tour.key.title` | Your own key | 用你自己的 Key | Votre propre clé | Dein eigener Schlüssel | ご自身のキーで |
| `tour.key.text` | Linguist uses your DeepSeek key and nothing else. It stays in this browser; paste it here to begin. | Linguist 只用你的 DeepSeek Key，别的都不用。它留在这个浏览器里——粘贴到这里就能开始。 | Linguist utilise votre clé DeepSeek et rien d’autre. Elle reste dans ce navigateur : collez-la ici pour commencer. | Linguist nutzt deinen DeepSeek-Schlüssel und sonst nichts. Er bleibt in diesem Browser — füge ihn hier ein und leg los. | Linguist が使うのは DeepSeek のキーだけで、ほかには何も送りません。キーはこのブラウザーに残ります。ここに貼れば始められます。 |
| `field.stratum` | Stratum | 语层 | Couche | Schicht | 語層 |
| `field.base` | Base | 基本形 | Base | Grundform | 基本形 |
| `field.thirdPerson` | 3rd person | 第三人称 | 3ᵉ personne | 3. Person | 三人称 |
| `field.past` | Past | 过去式 | Passé | Präteritum | 過去 |
| `field.participle` | Participle | 分词 | Participe | Partizip | 分詞 |
| `field.gerund` | Gerund | 现在分词 | Gérondif | Gerundium | 動名詞 |
| `field.class` | Class | 词类 | Groupe | Klasse | 活用の型 |
| `field.stem` | Stem | 词干 | Radical | Stamm | 語幹 |
| `field.auxiliary` | Auxiliary | 助动词 | Auxiliaire | Hilfsverb | 助動詞 |
| `field.gender` | Gender | 性 | Genre | Genus | 性 |
| `field.article` | Article | 冠词 | Article | Artikel | 冠詞 |
| `field.plural` | Plural | 复数 | Pluriel | Plural | 複数 |
| `field.position` | Position | 位置 | Position | Stellung | 位置 |
| `field.comparative` | Comparative | 比较级 | Comparatif | Komparativ | 比較級 |
| `field.superlative` | Superlative | 最高级 | Superlatif | Superlativ | 最上級 |
| `field.absolute` | Absolute | 绝对级 | Absolu | Absolut | 絶対級 |
| `field.kind` | Kind | 类别 | Type | Art | 種類 |
| `field.pos` | Part of speech | 词性 | Nature | Wortart | 品詞 |
| `field.subtype` | Subtype | 子类 | Sous-type | Untertyp | 下位分類 |
| `field.transitivity` | Transitivity | 及物性 | Transitivité | Transitivität | 他動性 |
| `field.countability` | Countability | 可数性 | Comptabilité | Zählbarkeit | 可算性 |
| `field.aspect` | Aspect | 体 | Aspect | Aspekt | 相 |
| `field.level` | Level | 等级 | Niveau | Niveau | レベル |
| `field.from` | From | 来自 | D’origine | Aus | 由来 |
| `field.original` | Original | 原形 | Original | Original | 原語 |
| `field.literally` | Literally | 字面义 | Littéralement | Wörtlich | 字義 |
| `field.source` | Source | 出处 | Source | Quelle | 出典 |
| `field.author` | Author | 作者 | Auteur | Autor | 作者 |
| `field.then` | Then | 当时义 | À l’époque | Damals | 当時の意味 |
| `field.case` | Case | 格 | Cas | Kasus | 格 |
| `field.singular` | Singular | 单数 | Singulier | Singular | 単数 |
| `field.word` | Word | 词 | Mot | Wort | 語 |
| `field.meaning` | Meaning | 含义 | Sens | Bedeutung | 意味 |
| `field.note` | Note | 说明 | Remarque | Hinweis | 注記 |
| `field.on` | On readings | 音读 | Lectures on | On-Lesungen | 音読み |
| `field.kun` | Kun readings | 训读 | Lectures kun | Kun-Lesungen | 訓読み |
| `field.special` | Special readings | 特殊读音 | Lectures spéciales | Sonderlesungen | 特殊な読み |
| `field.primarySense` | Primary sense | 本义 | Sens premier | Grundbedeutung | 本義 |
| `field.figurativeSense` | Figurative sense | 比喻义 | Sens figuré | Übertragene Bedeutung | 比喩義 |
| `field.now` | Today | 今义 | Aujourd'hui | Heute | 今の意味 |
| `field.okurigana` | okurigana | 送假名 | okurigana | Okurigana | 送り仮名 |
| `profile.showTour` | Show the tour again | 重新看一遍引导 | Revoir la visite guidée | Einführung noch einmal zeigen | 案内をもう一度見る |
| `app.name` | Linguist | Linguist | Linguist | Linguist | Linguist |
| `app.tagline` | The roots of words | 从词根读懂一个词 | La racine avant la définition | Die Wurzel vor der Bedeutung | 語根から語を知る |
| `app.description` | A dictionary built on word roots: five languages, whole sentences and whole files, explained from the inside out. | 一部以词根为纲的词典：五种语言，整句与整份文件，都从词根、词缀与字形讲起。 | Un dictionnaire bâti sur les racines : cinq langues, des phrases entières et des fichiers entiers, expliqués depuis l'intérieur. | Ein Wörterbuch, das von den Wortwurzeln ausgeht: fünf Sprachen, ganze Sätze und ganze Dateien, von innen heraus erklärt. | 語根を手がかりにする辞書です。5 つの言語、文まるごと、ファイルまるごとを、内側から解説します。 |
| `profile.topbar` | Profile | 个人 | Profil | Profil | 個人 |
| `profile.install.title` | Install app | 安装应用 | Installer l'application | App installieren | アプリをインストール |
| `profile.install.text` | Adds {app} to your dock, taskbar or home screen and opens it in its own window. | 把{app}加到程序坞、任务栏或主屏幕，以独立窗口打开。 | Ajoute {app} au Dock, à la barre des tâches ou à l'écran d'accueil et l'ouvre dans sa propre fenêtre. | Legt {app} in Dock, Taskleiste oder Startbildschirm ab und öffnet es in einem eigenen Fenster. | {app} をドックやタスクバー、ホーム画面に追加し、独立したウィンドウで開きます。 |
| `profile.install.action` | Install | 安装 | Installer | Installieren | インストール |
| `profile.key.field` | API key | API Key | Clé API | API-Schlüssel | API キー |
| `profile.key.save` | Save key | 保存 Key | Enregistrer la clé | Schlüssel speichern | 保存 |
| `profile.key.test` | Test connection | 测试连接 | Tester la connexion | Verbindung testen | 接続を確認 |
| `profile.key.show` | Show | 显示 | Afficher | Anzeigen | 表示 |
| `profile.key.hide` | Hide | 隐藏 | Masquer | Verbergen | 隠す |
| `profile.key.enterFirst` | Enter a key first. | 请先填入 Key。 | Saisissez d'abord une clé. | Gib zuerst einen Schlüssel ein. | 先にキーを入力してください。 |
| `profile.key.ok` | Connection works. The model replied “{sample}”. | 连接正常，模型的回复是「{sample}」。 | La connexion fonctionne. Le modèle a répondu « {sample} ». | Die Verbindung funktioniert. Das Modell antwortete „{sample}“. | 接続できました。モデルの返答は「{sample}」です。 |
| `profile.model.hint` | Switching the model or the explanation language makes the next lookup of the same word regenerate. | 换模型或换解释语言后，同一个词下次查询会重新生成。 | Changer de modèle ou de langue d'explication fait régénérer la prochaine recherche du même mot. | Ein Wechsel des Modells oder der Erklärungssprache lässt die nächste Suche desselben Wortes neu erzeugen. | モデルや説明言語を変えると、同じ語の次回の検索は作り直されます。 |
| `practice.replayLocked` | Show a hint first, then you can hear it | 先用一次提示，之后可以播放 | Affichez d'abord un indice, puis écoutez | Zeige zuerst einen Hinweis, dann kannst du es hören | まずヒントを表示すると再生できます |
| `theme.auto` | Auto | 自动 | Auto | Automatisch | 自動 |
| `theme.light` | Light | 浅色 | Clair | Hell | ライト |
| `theme.dark` | Dark | 深色 | Sombre | Dunkel | ダーク |
| `model.flash.hint` | Fast, 1M context — best for lookups | 快，100 万上下文——最适合查词 | Rapide, contexte de 1 M — idéal pour la consultation | Schnell, 1 Mio. Kontext — am besten zum Nachschlagen | 高速・100 万トークンの文脈。調べ物に最適 |
| `model.pro.hint` | Deeper reasoning, noticeably slower | 推理更深，但明显更慢 | Raisonnement plus profond, nettement plus lent | Tieferes Schlussfolgern, deutlich langsamer | より深い推論。ただし明らかに遅い |
| `field.via` | Via | 经由 | Via | Über | 経由 |
| `field.attested` | First attested | 首见 | Première attestation | Erstmals belegt | 初出 |
| `field.certainty` | Certainty | 可信度 | Fiabilité | Sicherheit | 確度 |
| `mode.file` | File | 文件 | Fichier | Datei | ファイル |
| `group.document` | File | 文件 | Fichier | Datei | ファイル |
| `dict.badge.document` | File | 文件 | Fichier | Datei | ファイル |
| `entry.noCardsTitle` | No cards to show | 没有可显示的卡片 | Aucune carte à afficher | Keine Karten anzuzeigen | 表示するカードがありません |
| `entry.irregularComparison` | Irregular comparison — it has to be memorised. | 不规则比较级——只能单独记住。 | Comparatif irrégulier — à mémoriser tel quel. | Unregelmäßige Steigerung — muss auswendig gelernt werden. | 不規則な比較級です。個別に覚える必要があります。 |
| `file.truncated` | The source text past {n} characters was not kept on this device, so re-reading this file in another language would read only the part that was. | 原文中超过 {n} 字的部分没有留在本机；换一种解释语言重读时，只会读到保留下来的那一段。 | Le texte source au-delà de {n} caractères n'a pas été conservé sur cet appareil : relire ce fichier dans une autre langue ne lirait que la partie gardée. | Der Quelltext jenseits von {n} Zeichen wurde auf diesem Gerät nicht behalten; ein erneutes Lesen in einer anderen Sprache läse nur den behaltenen Teil. | {n} 文字を超える本文はこの端末に保存していません。別の言語で読み直す場合も、保存した範囲だけを読みます。 |
| `file.title` | Read a file | 读一份文件 | Lire un fichier | Eine Datei lesen | ファイルを読む |
| `file.pick` | Choose a file | 选择文件 | Choisir un fichier | Datei wählen | ファイルを選ぶ |
| `file.drop` | Drop a file here, or choose one | 把文件拖到这里，或点击选择 | Déposez un fichier ici, ou choisissez-en un | Datei hier ablegen oder auswählen | ここにファイルをドロップするか、選んでください |
| `file.change` | Change file | 换一个文件 | Changer de fichier | Andere Datei | 別のファイル |
| `file.clear` | Clear | 清除 | Effacer | Entfernen | 取り消す |
| `file.language` | The file's language | 文件的语言 | Langue du fichier | Sprache der Datei | ファイルの言語 |
| `file.language.placeholder` | Choose a language | 请选择语言 | Choisissez une langue | Sprache wählen | 言語を選んでください |
| `file.language.hint` | Say which language the file is written in. It is never guessed for you. | 请指明文件用的是哪种语言，这个词不会替你猜。 | Indiquez la langue du fichier : elle n'est jamais devinée. | Gib die Sprache der Datei an — geraten wird sie nie. | ファイルの言語を指定してください。自動では判定しません。 |
| `file.analyse` | Read it | 开始解读 | Lire | Lesen | 読み取る |
| `file.reading` | Reading the file… | 正在读取文件…… | Lecture du fichier… | Datei wird gelesen … | ファイルを読み込んでいます… |
| `file.chars` | {n} characters | {n} 字 | {n} caractères | {n} Zeichen | {n} 文字 |
| `file.oneRequest` | 1 request | 1 次请求 | 1 requête | 1 Anfrage | リクエスト 1 回 |
| `file.requests` | {n} requests | {n} 次请求 | {n} requêtes | {n} Anfragen | リクエスト {n} 回 |
| `file.empty` | There is no readable text in that file. | 这份文件里没有可读的文字。 | Ce fichier ne contient pas de texte lisible. | In dieser Datei steht kein lesbarer Text. | このファイルには読める文字がありません。 |
| `file.unsupported` | That kind of file cannot be read. Text, Markdown, subtitles, HTML, DOCX and PDF can. | 不支持这种文件。可读纯文本、Markdown、字幕、HTML、DOCX 与 PDF。 | Ce type de fichier n'est pas lisible. Le texte, Markdown, les sous-titres, le HTML, le DOCX et le PDF le sont. | Dieser Dateityp ist nicht lesbar. Text, Markdown, Untertitel, HTML, DOCX und PDF sind es. | この形式は読めません。テキスト、Markdown、字幕、HTML、DOCX、PDF が使えます。 |
| `file.legacyDoc` | This is an old Word file (.doc). Save it as .docx and try again. | 这是旧版 Word 文件（.doc）。请另存为 .docx 再试。 | C'est un ancien fichier Word (.doc). Enregistrez-le en .docx et réessayez. | Das ist eine alte Word-Datei (.doc). Speichere sie als .docx und versuche es erneut. | 旧形式の Word ファイル（.doc）です。.docx として保存し直してください。 |
| `file.docxUnavailable` | This browser cannot unpack .docx files here. Save the text as .txt instead. | 当前环境解不开 .docx，请把文本另存为 .txt 再试。 | Cet environnement ne peut pas ouvrir les .docx. Enregistrez le texte en .txt. | Diese Umgebung kann .docx nicht entpacken. Speichere den Text als .txt. | この環境では .docx を展開できません。テキストとして保存し直してください。 |
| `file.docxFailed` | This .docx could not be opened. It may be damaged. | 这个 .docx 打不开，可能已经损坏。 | Ce .docx n'a pas pu être ouvert. Il est peut-être abîmé. | Diese .docx ließ sich nicht öffnen. Vielleicht ist sie beschädigt. | この .docx を開けませんでした。壊れている可能性があります。 |
| `file.docxTooLarge` | This .docx is larger than {max} MB — more text than this app reads. | 这个 .docx 超过 {max} MB，超出本应用愿意读取的文本量。 | Ce .docx dépasse {max} Mo — plus de texte que cette application n'en lit. | Diese .docx ist größer als {max} MB — mehr Text, als diese App liest. | この .docx は {max} MB を超えています。このアプリが読む量を超えています。 |
| `file.tooLong` | That file is {n} characters long, and the limit is {max}. Split it and read the parts separately. | 这份文件有 {n} 字，上限是 {max} 字。请拆分后再分别解读。 | Ce fichier fait {n} caractères, pour une limite de {max}. Découpez-le et lisez les parties séparément. | Die Datei hat {n} Zeichen, die Grenze liegt bei {max}. Teile sie auf und lies die Teile einzeln. | このファイルは {n} 文字で、上限は {max} 文字です。分割してから読み取ってください。 |
| `file.pdfUnavailable` | PDF reading is not available here, so this file cannot be opened. Save it as text and try again. | 当前环境读不了 PDF，请先另存为纯文本再试。 | La lecture des PDF n'est pas disponible ici. Enregistrez le fichier en texte et réessayez. | PDFs lassen sich hier nicht lesen. Speichere die Datei als Text und versuche es erneut. | ここでは PDF を読めません。テキストとして保存し直してからお試しください。 |
| `file.pdfEncrypted` | This PDF is password-protected, so it cannot be read here. | 这份 PDF 有密码保护，这里读不了。 | Ce PDF est protégé par un mot de passe : il ne peut pas être lu ici. | Dieses PDF ist passwortgeschützt und lässt sich hier nicht lesen. | この PDF はパスワードで保護されているため、ここでは読めません。 |
| `file.pdfFailed` | This PDF could not be opened. It may be damaged. | 这份 PDF 打不开，可能已经损坏。 | Ce PDF n'a pas pu être ouvert. Il est peut-être abîmé. | Dieses PDF ließ sich nicht öffnen. Vielleicht ist es beschädigt. | この PDF を開けませんでした。壊れている可能性があります。 |
| `file.noReader` | This browser cannot read local files. | 这个浏览器无法读取本地文件。 | Ce navigateur ne peut pas lire les fichiers locaux. | Dieser Browser kann keine lokalen Dateien lesen. | このブラウザーはローカルのファイルを読めません。 |
| `file.readFailed` | The file could not be read. | 文件读取失败。 | Le fichier n'a pas pu être lu. | Die Datei konnte nicht gelesen werden. | ファイルを読み込めませんでした。 |
| `file.scanned` | This PDF has no text layer — it is a scan of pages. Reading it would need OCR, which this app does not do. | 这份 PDF 没有文字层，是扫描件。读它需要 OCR，本应用不做这件事。 | Ce PDF n'a pas de couche texte : c'est un scan. Le lire demanderait de l'OCR, ce que cette application ne fait pas. | Dieses PDF hat keine Textebene — es ist ein Scan. Zum Lesen wäre OCR nötig, was diese App nicht macht. | この PDF には文字層がなく、スキャン画像です。読むには OCR が必要ですが、このアプリは行いません。 |
| `file.notice` | The text you choose is sent to DeepSeek with your own key so it can be translated and summarised. It is stored nowhere but this device. | 所选文本会连同你的 Key 一起发给 DeepSeek，用于翻译与概括；除本机外不留任何副本。 | Le texte choisi part chez DeepSeek avec votre clé pour être traduit et résumé. Il n'est stocké nulle part ailleurs que sur cet appareil. | Der gewählte Text geht mit deinem Schlüssel an DeepSeek, damit er übersetzt und zusammengefasst werden kann. Gespeichert wird er nur auf diesem Gerät. | 選んだ本文は、翻訳と要約のためにあなたのキーで DeepSeek に送信されます。この端末以外には保存されません。 |
| `file.needFile` | Choose a file first. | 请先选择文件。 | Choisissez d'abord un fichier. | Wähle zuerst eine Datei. | 先にファイルを選んでください。 |
| `file.needLang` | Choose the file's language first. | 请先选择文件的语言。 | Choisissez d'abord la langue du fichier. | Wähle zuerst die Sprache der Datei. | 先にファイルの言語を選んでください。 |
| `doc.whole` | Whole file | 整份文件 | Fichier entier | Ganze Datei | ファイル全体 |
| `doc.read` | {n} of {total} parts | 共 {total} 部分，已读 {n} 部分 | {n} parties sur {total} | {n} von {total} Teilen | {total} のうち {n} 部分 |
| `doc.progress` | Part {n} of {total}… | 第 {n} / {total} 部分…… | Partie {n} sur {total}… | Teil {n} von {total} … | {total} のうち {n} 番目… |
| `doc.partial` | Stopped after part {n} of {total}. What finished is below. | 在第 {n} / {total} 部分停下，下面是已完成的内容。 | Arrêt après la partie {n} sur {total}. Ce qui est terminé suit. | Nach Teil {n} von {total} abgebrochen. Was fertig ist, steht unten. | {total} のうち {n} 番目で中断しました。できた分は下にあります。 |
| `doc.resume` | Continue from part {n} | 从第 {n} 部分继续 | Reprendre à la partie {n} | Ab Teil {n} fortsetzen | {n} 番目から続ける |
| `doc.cancel` | Stop | 停止 | Arrêter | Stoppen | 中断 |
| `doc.cancelled` | Stopped. What finished is below. | 已停止，下面是已完成的内容。 | Arrêté. Ce qui est terminé suit. | Gestoppt. Was fertig ist, steht unten. | 中断しました。できた分は下にあります。 |
| `profile.section.cards` | Cards | 卡片 | Cartes | Karten | カード |
| `profile.cards.hint` | Every entry is a set of cards. Hide the ones you never read and move the ones you do to the top. Each reading family keeps its own arrangement. | 每个词条都由一组卡片组成。用不上的可以隐藏，常看的可以移到前面；三种语言族各记各的顺序。 | Chaque entrée est un ensemble de cartes. Masquez celles que vous ne lisez jamais et remontez celles que vous lisez : chaque famille garde son propre ordre. | Jeder Eintrag besteht aus Karten. Blende aus, was du nie liest, und schiebe nach oben, was du liest — jede Sprachfamilie behält ihre eigene Reihenfolge. | 項目はカードの集まりです。読まないカードは隠し、よく読むカードは上へ。並び順は言語系統ごとに別々に保たれます。 |
| `profile.cards.count` | {shown} of {total} | {shown} / {total} | {shown} sur {total} | {shown} von {total} | {total} のうち {shown} |
| `profile.cards.group.latin` | English, French, German | 英语、法语、德语 | Anglais, français, allemand | Englisch, Französisch, Deutsch | 英語・フランス語・ドイツ語 |
| `profile.cards.group.ja` | Japanese | 日语 | Japonais | Japanisch | 日本語 |
| `profile.cards.group.zh` | Chinese | 中文 | Chinois | Chinesisch | 中国語 |
| `profile.cards.group.sentence` | Sentence analysis | 句子分析 | Analyse de phrase | Satzanalyse | 文の分析 |
| `profile.cards.hide` | Hide | 隐藏 | Masquer | Ausblenden | 隠す |
| `profile.cards.show` | Show | 显示 | Afficher | Einblenden | 表示 |
| `profile.cards.up` | Move up | 上移 | Monter | Nach oben | 上へ |
| `profile.cards.toTop` | Move to top | 置顶 | Mettre en premier | Ganz nach oben | 先頭へ |
| `profile.cards.down` | Move down | 下移 | Descendre | Nach unten | 下へ |
| `profile.cards.reset` | Reset this group | 恢复本组 | Rétablir ce groupe | Diese Gruppe zurücksetzen | この組を戻す |
| `profile.cards.resetAll` | Reset all | 全部恢复 | Tout rétablir | Alles zurücksetzen | すべて戻す |
| `profile.cards.resetDone` | Card order restored. | 卡片顺序已恢复。 | Ordre des cartes rétabli. | Kartenreihenfolge wiederhergestellt. | カードの順番を戻しました。 |
| `profile.cards.allHidden` | Every card here is hidden, so an entry would show nothing. Turn one back on. | 这一组全被隐藏了，词条会什么都不显示。请至少打开一张。 | Toutes les cartes de ce groupe sont masquées : une entrée n'afficherait rien. Réactivez-en une. | Hier ist jede Karte ausgeblendet — ein Eintrag würde nichts zeigen. Blende eine wieder ein. | この組はすべて非表示です。項目に何も表示されません。1 つだけでも戻してください。 |
| `entry.noCards` | Every card for this language is hidden. Profile → Cards turns them back on. | 这种语言的卡片都被隐藏了。可在「个人 → 卡片」里重新打开。 | Toutes les cartes de cette langue sont masquées. Profil → Cartes les réactive. | Für diese Sprache sind alle Karten ausgeblendet. Profil → Karten holt sie zurück. | この言語のカードはすべて非表示です。「個人 → カード」で戻せます。 |
| `entry.line.etymology` | Word root | 词根 | Racine | Wortwurzel | 語源 |
| `entry.line.usage` | Meaning and use | 释义与用法 | Sens et emploi | Bedeutung und Gebrauch | 意味と用法 |
| `entry.line.inflection` | Forms and grammar | 词形与语法 | Formes et grammaire | Formen und Grammatik | 語形と文法 |
| `entry.line.distinction` | Disambiguation | 辨析 | Confusions | Abgrenzung | 使い分け |
| `entry.line.semantics` | Meaning | 语义 | Sens | Bedeutung | 意味 |
| `entry.line.grammar` | Grammar and structure | 语法与结构 | Grammaire et structure | Grammatik und Struktur | 文法と構造 |
| `entry.line.document` | The file | 文件 | Le fichier | Die Datei | ファイル |
| `field.genre` | Genre | 体裁 | Genre | Textsorte | ジャンル |
| `field.register` | Register | 语体 | Registre | Register | 文体 |
| `field.period` | Period | 年代 | Époque | Zeit | 時代 |
| `field.notes` | Notes | 备注 | Remarques | Notizen | 備考 |
| `field.term` | Term | 词条 | Terme | Ausdruck | 語 |
| `field.reading` | Reading | 读音 | Prononciation | Aussprache | 読み |
| `field.example` | In the text | 原文例句 | Dans le texte | Im Text | 本文の例 |
| `tour.file.title` | Or a whole file | 也可以读整份文件 | Ou un fichier entier | Oder eine ganze Datei | ファイルごと読むこともできます |
| `tour.file.text` | Choose a text or PDF, say which language it is in, and you get a summary, a translation, a glossary and a note on its register. Long files are read part by part. | 选一份文本或 PDF，指明它的语言，就能拿到概要、译文、词汇表和文体说明；长文件会分段读。 | Choisissez un texte ou un PDF, indiquez sa langue : vous obtenez un résumé, une traduction, un lexique et une note de registre. Les fichiers longs sont lus par parties. | Wähle einen Text oder ein PDF und gib seine Sprache an: du bekommst eine Zusammenfassung, eine Übersetzung, eine Wortliste und eine Registereinordnung. Lange Dateien werden in Teilen gelesen. | テキストか PDF を選び、その言語を指定すると、要約・翻訳・語彙リスト・文体の説明が得られます。長いファイルは分割して読み込みます。 |
| `tour.cards.title` | Your cards, your order | 卡片由你决定 | Vos cartes, votre ordre | Deine Karten, deine Reihenfolge | カードは自分で決める |
| `tour.cards.text` | Profile → Cards decides which cards an entry shows and in which order: one arrangement for the Latin-script languages, one for Japanese, one for Chinese. | 「个人 → 卡片」决定词条显示哪些卡片、顺序如何：拉丁字母语言、日语、中文各有一套。 | Profil → Cartes décide quelles cartes une entrée affiche et dans quel ordre : un arrangement pour les langues latines, un pour le japonais, un pour le chinois. | Profil → Karten bestimmt, welche Karten ein Eintrag zeigt und in welcher Reihenfolge: eine Ordnung für die lateinisch schreibenden Sprachen, eine für Japanisch, eine für Chinesisch. | 「個人 → カード」で、項目に表示するカードとその順番を決められます。ラテン文字の言語・日本語・中国語でそれぞれ別に保存されます。 |
| `tour.roots.title` | Roots that come back | 词根会回来找你 | Les racines reviennent | Wurzeln kommen wieder | 語根はまた戻ってくる |
| `tour.roots.text` | The Roots tab turns etymology into review: due roots, five mixed questions, and words linked back to the parts they are made of. | 「词根」把词源变成复习：到期的词根、五题混合练习，以及从这个词根长出来的一族词。 | Racines transforme l’étymologie en révision : racines à revoir, cinq questions mixtes et mots reliés à leurs composants. | Wurzeln macht Etymologie zur Wiederholung: fällige Wurzeln, fünf gemischte Fragen und Wörter, die zu ihren Bausteinen zurückführen. | 「語根」は語源を復習に変えます。復習待ちの語根、選択と入力の五問、そして語根から広がる語の家族。 |
