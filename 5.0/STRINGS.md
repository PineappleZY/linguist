# Radicle 5.0 — 界面文案对照表

这份表是 `web/js/strings.js` 的直接产物，供你或母语者复核。共 **306 条 × 5 种语言**。

**怎么用**：切到某一语言后，可能觉得某句不像该语言的人会说的话——直接在表里指出 key 与建议改法即可，我会改 `strings.js`（改一行，五个语言各自独立）。

**我不确定、最需要复核的几处**（我按各自惯用写法写了，但没有母语者校对）：

| key | 我的顾虑 |
| --- | --- |
| `nav.starred` | 英语改成了 Starred；中文用「星标」、法文 «Favoris»、德文 „Favoriten"、日文「お気に入り」——这四种是各自语言里对"收藏/星标"最自然的说法，但它们并不是同一个词的直译 |
| `tour.*` 系列 | 引导文案的敬体程度（日语）与亲切度（德语 du / 法语 vous）——我统一用了日语です・ます、德语 du、法语 vous |
| `entry.disclaimer` | 免责声明在四种语言里的"分寸"：英语用了 not gospel，中文「不是定论」，法语/德语相应弱化 |
| `profile.install.*` | iOS「添加到主屏幕」在各语言的系统里官方译法不同（日语「ホーム画面に追加」、德语 „Zum Home-Bildschirm"），我按各系统惯例写 |
| `error.*` | 错误文案的语气：英语保持简短，中文偏中性，德语偏直接——如果希望统一更克制的口吻，指出来即可 |

| key | English | 中文 | Français | Deutsch | 日本語 |
| --- | --- | --- | --- | --- | --- |
| `nav.dictionary` | Dictionary | 词典 | Dictionnaire | Wörterbuch | 辞書 |
| `nav.starred` | Starred | 星标 | Favoris | Favoriten | お気に入り |
| `nav.profile` | Profile | 个人 | Profil | Profil | 個人 |
| `date.today` | Today | 今天 | Aujourd'hui | Heute | 今日 |
| `date.yesterday` | Yesterday | 昨天 | Hier | Gestern | 昨日 |
| `date.now` | just now | 刚刚 | à l'instant | gerade eben | たった今 |
| `date.minutes` | {n}m ago | {n} 分钟前 | il y a {n} min | vor {n} Min. | {n} 分前 |
| `date.hours` | {n}h ago | {n} 小时前 | il y a {n} h | vor {n} Std. | {n} 時間前 |
| `common.undo` | Undo | 撤销 | Annuler | Rückgängig | 元に戻す |
| `common.cancel` | Cancel | 取消 | Annuler | Abbrechen | キャンセル |
| `common.retry` | Try again | 重试 | Réessayer | Nochmal | もう一度 |
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
| `entry.notOnDeviceText` | Radicle stores answers locally, so this link only works where the lookup happened. | Radicle 把答案存在本地，这个链接只能在当初查询的设备上打开。 | Radicle garde les réponses en local : ce lien ne fonctionne que là où la recherche a eu lieu. | Radicle speichert Antworten lokal — dieser Link funktioniert nur dort, wo nachgeschlagen wurde. | Radicle は答えを端末内に保存します。このリンクは、調べたことのある端末でだけ開けます。 |
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
| `fav.sentences` | Sentences | 句子 | Phrases | Sätze | 文 |
| `fav.retired` | retired | 已停用 | retirée | stillgelegt | 提供終了 |
| `fav.unknown` | Language unknown | 语言未知 | Langue inconnue | Sprache unbekannt | 言語が不明 |
| `fav.unknownText` | These were saved before Radicle recorded a language. Identifying them asks about a few at a time. | 这些词条保存时还没记录语言。识别会一次问几个。 | Ces entrées ont été enregistrées avant que Radicle note la langue. L'identification en demande quelques-unes à la fois. | Diese Einträge entstanden, bevor Radicle die Sprache notierte. Die Erkennung fragt jeweils ein paar auf einmal. | これらは言語が記録される前に保存されたものです。判定は数件ずつ行います。 |
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
| `profile.noKey.text` | Radicle only works once your own DeepSeek API key is in place. | 只有填好你自己的 DeepSeek API Key，Radicle 才能工作。 | Radicle ne fonctionne qu'avec votre propre clé API DeepSeek. | Radicle arbeitet nur mit deinem eigenen DeepSeek-Schlüssel. | ご自身の DeepSeek API キーがないと Radicle は動きません。 |
| `profile.install` | Install app | 安装应用 | Installer l'application | App installieren | アプリをインストール |
| `profile.install.offline` | Not available in the offline single-file build. | 离线单文件版不支持安装。 | Indisponible dans la version hors ligne en un seul fichier. | In der Einzeldatei-Version offline nicht möglich. | オフライン単一ファイル版では使えません。 |
| `profile.install.installed` | Running as an installed app. | 正以已安装应用的方式运行。 | Fonctionne comme application installée. | Läuft als installierte App. | インストール済みアプリとして動作中です。 |
| `profile.install.chip` | installed | 已安装 | installée | installiert | インストール済み |
| `profile.install.ios` | Tap Share in Safari, then “Add to Home Screen”. | 在 Safari 里点“分享”，再选“添加到主屏幕”。 | Touchez Partager dans Safari, puis « Sur l’écran d’accueil ». | Tippe in Safari auf Teilen, dann „Zum Home-Bildschirm“. | Safari で共有をタップし、「ホーム画面に追加」を選びます。 |
| `profile.install.needsHttps` | Installation needs an https address. Open the hosted version to install. | 安装需要 https 地址，请打开在线版再安装。 | L'installation exige une adresse https. Ouvrez la version hébergée pour installer. | Zum Installieren braucht es eine https-Adresse. Öffne die gehostete Version. | インストールには https のアドレスが必要です。公開版を開いてください。 |
| `profile.install.menu` | Use your browser menu: Install app, or Add to Home Screen. | 用浏览器菜单里的“安装应用”或“添加到主屏幕”。 | Passez par le menu du navigateur : Installer, ou Ajouter à l'écran d'accueil. | Nimm das Browsermenü: App installieren oder Zum Home-Bildschirm. | ブラウザーのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。 |
| `profile.key.placeholder` | sk-... | sk-... | sk-... | sk-... | sk-... |
| `profile.key.hint` | Stored as plain text in this browser only. Get a key at  | 以明文只保存在本机浏览器。Key 可在  | Stockée en clair dans ce navigateur uniquement. Obtenez une clé sur  | Nur in diesem Browser im Klartext gespeichert. Einen Schlüssel gibt es bei  | このブラウザーに平文で保存されます。キーはこちらで取得できます： |
| `profile.key.save` | Save key | 保存 | Enregistrer | Speichern | 保存 |
| `profile.key.test` | Test connection | 测试连接 | Tester la connexion | Verbindung testen | 接続を確認 |
| `profile.key.testing` | Contacting DeepSeek… | 正在连接 DeepSeek… | Connexion à DeepSeek… | Verbinde mit DeepSeek… | DeepSeek に接続しています… |
| `profile.key.saved` | Key saved | 已保存 | Clé enregistrée | Schlüssel gespeichert | 保存しました |
| `profile.key.cleared` | Key cleared | 已清除 | Clé effacée | Schlüssel gelöscht | キーを消しました |
| `profile.model.hint` | Switching the model or the explanation language makes the next lookup of the same entry regenerate. | 换模型或换解释语言后，下次查同一个词会重新生成。 | Changer de modèle ou de langue d'explication régénère la prochaine recherche de la même entrée. | Ein anderes Modell oder eine andere Erklärungssprache lässt das nächste Nachschlagen desselben Eintrags neu erzeugen. | モデルや説明の言語を変えると、次に同じ項目を調べたときに再生成します。 |
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
| `profile.backup.old` | Import from Radicle {version} | 从 Radicle {version} 导入 | Importer depuis Radicle {version} | Aus Radicle {version} importieren | Radicle {version} から読み込む |
| `profile.backup.oldHint` | Reads the older version once; it is never modified | 只读取旧版本一次，绝不修改它 | L'ancienne version est lue une fois, jamais modifiée | Liest die alte Version einmal, ändert sie nie | 古い版を一度読むだけで、書き換えません |
| `profile.backup.neverKey` | Backups never contain your API key. | 备份里永远不含 API Key。 | Les sauvegardes ne contiennent jamais votre clé API. | Sicherungen enthalten nie deinen API-Schlüssel. | バックアップに API キーは含まれません。 |
| `profile.backup.exported` | Backup exported | 已导出 | Sauvegarde exportée | Sicherung exportiert | 書き出しました |
| `profile.backup.exportFailed` | Export failed: {message} | 导出失败：{message} | Échec de l'export : {message} | Export fehlgeschlagen: {message} | 書き出しに失敗：{message} |
| `profile.backup.restored` | Restored {n} entries | 已恢复 {n} 条 | {n} entrées restaurées | {n} Einträge wiederhergestellt | {n} 件を復元しました |
| `profile.backup.importFailed` | Import failed: {message} | 导入失败：{message} | Échec de l'import : {message} | Import fehlgeschlagen: {message} | 読み込みに失敗：{message} |
| `profile.backup.readFailed` | Could not read that file | 读不了这个文件 | Impossible de lire ce fichier | Diese Datei ließ sich nicht lesen | このファイルを読めませんでした |
| `profile.import.confirm` | Import the data from Radicle {version}? It is only read, never changed. | 从 Radicle {version} 导入数据？只读，不会改动旧数据。 | Importer les données de Radicle {version} ? Elles sont seulement lues, jamais modifiées. | Daten aus Radicle {version} importieren? Sie werden nur gelesen, nie geändert. | Radicle {version} のデータを読み込みますか？ 読むだけで、変更はしません。 |
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
| `profile.importFirstRun` | Radicle {version} data was found on this device. Import it into {app} {current}? The older data is read once and left untouched. | 本机发现了 Radicle {version} 的数据。要导入到 {app} {current} 吗？旧数据只读一次，不会被改动。 | Des données Radicle {version} ont été trouvées sur cet appareil. Les importer dans {app} {current} ? Les anciennes données sont lues une fois et laissées intactes. | Auf diesem Gerät liegen Daten von Radicle {version}. In {app} {current} importieren? Die alten Daten werden einmal gelesen und bleiben unangetastet. | この端末に Radicle {version} のデータがあります。{app} {current} に読み込みますか？ 古いデータは一度読むだけで、そのまま残ります。 |
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
| `tour.key.text` | Radicle uses your DeepSeek key and nothing else. It stays in this browser; paste it here to begin. | Radicle 只用你的 DeepSeek Key，别的都不用。它留在这个浏览器里——粘贴到这里就能开始。 | Radicle utilise votre clé DeepSeek et rien d’autre. Elle reste dans ce navigateur : collez-la ici pour commencer. | Radicle nutzt deinen DeepSeek-Schlüssel und sonst nichts. Er bleibt in diesem Browser — füge ihn hier ein und leg los. | Radicle が使うのは DeepSeek のキーだけで、ほかには何も送りません。キーはこのブラウザーに残ります。ここに貼れば始められます。 |
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
| `field.register` | Register | 语域 | Registre | Register | 文体 |
| `field.means` | Means | 手段 | Moyen | Mittel | 手段 |
| `field.case` | Case | 格 | Cas | Kasus | 格 |
| `field.singular` | Singular | 单数 | Singulier | Singular | 単数 |
| `field.word` | Word | 词 | Mot | Wort | 語 |
| `field.meaning` | Meaning | 含义 | Sens | Bedeutung | 意味 |
| `field.note` | Note | 说明 | Remarque | Hinweis | 注記 |
| `profile.showTour` | Show the tour again | 重新看一遍引导 | Revoir la visite guidée | Einführung noch einmal zeigen | 案内をもう一度見る |
