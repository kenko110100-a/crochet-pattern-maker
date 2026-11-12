'use strict';
/* "How to use" page. Text lives here in three languages; the step illustrations are drawn live
   by the same engine the editor uses, so they always match what the app really produces. */
(() => {
  const $ = s => document.querySelector(s);
  const cfg = (() => { try { return JSON.parse(localStorage.getItem('pm.cfg')) || {}; } catch { return {}; } })();
  if (!cfg.lang) cfg.lang = I18N.detect();

  const G = {
    en: {
      title: 'How to use the Pattern Maker', back: '← Back to the app',
      intro: 'This site draws crochet and knitting charts for you. You say which stitches go into each round or row; the chart arranges itself, counts the stitches and writes the instructions. Nothing is uploaded — your work stays in this browser.',
      modesH: 'Four kinds of chart',
      crochetH: 'Crochet: your first chart in five steps',
      steps: [
        ['Start a chart', 'On the front page choose <b>Crochet · in the round</b>, choose the stitch and how many go into the magic ring (6 single crochet is the usual start) and press <b>Start</b>. Round 1 appears around the ring.'],
        ['Add stitches by clicking', 'Press <b>Enter</b> (or <b>+ New round</b>) to begin round 2, then click a stitch in the stitch bar at the top. Each click works one stitch into the next stitch of the round below — the pulsing circle shows where it will go. Tip: click <b>inc</b> once, then press <b>Repeat to end</b> to fill the whole round.'],
        ['Or type the round', 'Every round has a text box on the right. Type <code>(sc, inc) x</code> and press Enter: the part in brackets repeats to the end of the round. The counter turns green with a ✓ when the round uses exactly the stitches below it, and says “3 left” or “2 over” when it does not.'],
        ['Mix tall stitches, chains and shells', 'Rounds grow by themselves to fit taller stitches. <code>sch 3</code> is a chain-3 that counts as the first stitch, <code>[dc 2, ch 2, dc 2]</code> works a whole shell into one stitch, <code>sk 2</code> skips two stitches and <code>join</code> closes the round with a slip stitch.'],
        ['Fix and colour', 'Click any stitch on the chart to select it — new stitches are then added right after it. <b>⌫</b> deletes it, the colour box in the right panel recolours it, and the coloured dot beside each round recolours the whole round. <b>Ctrl+Z</b> undoes anything. The sliders under <b>Fine-tune by hand</b> tilt, lengthen or move the selected stitches, and Copy / Paste repeats a motif.'],
      ],
      tourH: 'The editor at a glance',
      tour: ['<b>Stitch palette</b> — click to add a stitch. Hover to see its name and abbreviation.',
        '<b>Chart</b> — drag to move, scroll to zoom, click a stitch to select it.',
        '<b>Rounds</b> — one line per round: colour, typed instructions and stitch count. Click a line to work on that round.',
        '<b>Top bar</b> — undo and redo, zoom, symbol style, language, save and open, export.',
        '<b>Hint</b> — tells you what the current round still needs.'],
      rowsH: 'Crochet in rows',
      rowsP: 'This works the same way but starts from a foundation chain. Rows alternate direction as in real work, so begin each row with a turning chain: <code>tch 1</code> before single crochet (not counted as a stitch) or <code>sch 3</code> before double crochet (counted as a stitch).',
      cheatH: 'What you can type',
      knitH: 'Knitting charts',
      knit: ['Choose <b>Knitting chart</b> on the front page and set the number of stitches and rows. You can change the size later in the right panel.',
        'Pick a symbol in the bar at the top and <b>drag across the grid</b> to paint it. The Eraser turns cells back into plain knit.',
        'Cables cover several stitches: pick one and click once where it should go.',
        'Pick a colour and drag to paint colourwork; symbols stay on top of the colour.',
        'The right panel writes out every row. Right-side rows are read from the right and wrong-side rows from the left, so a knit symbol is written “p” on a wrong-side row. Choose <b>Worked in the round</b> if you knit in the round.',
        'The symbol menu in the top bar switches between JIS symbols ( | — ) and Western ones (blank and •).',
        'Scroll to move around, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + scroll to zoom, <kbd>Space</kbd> + drag to pan.'],
      saveH: 'Saving, opening and exporting',
      save: ['Every chart is saved automatically in this browser and listed under <b>Your charts</b> on the front page. <b>← Home</b> takes you back there.',
        '<b>Save</b> downloads a file you can keep or send to someone; <b>Open</b> loads it again.',
        '<b>Export → Print / PDF</b> makes a sheet with the chart, a key of the symbols used and the written instructions. PNG and SVG give the chart alone.'],
      keysH: 'Keyboard shortcuts (crochet)',
      keys: [['Enter', 'Start a new round or row'], ['⌫ / Delete', 'Delete the selected stitch, or the last one'], ['← →', 'Move the selection along the round'],
        ['Shift + click a stitch', 'Work it into the same stitch as the previous one'], ['Esc', 'Deselect'], ['Ctrl/⌘ + Z', 'Undo'], ['Ctrl/⌘ + Shift + Z', 'Redo']],
    },
    ja: {
      title: '使い方ガイド', back: '← アプリに戻る',
      intro: 'このサイトは、かぎ針編みと棒針編みの編み図を自動で描きます。各段にどの編み目を入れるかを指定するだけで、編み図の配置、目数の計算、編み方の文章まで自動で作成されます。データはアップロードされず、このブラウザ内に保存されます。',
      modesH: '4種類の編み図',
      crochetH: 'かぎ針編み：5ステップで最初の編み図',
      steps: [
        ['編み図を始める', 'トップページで<b>かぎ針編み・輪編み</b>を選び、輪の作り目に編み入れる編み目の種類と数を選んで<b>はじめる</b>を押します。輪のまわりに1段目が表示されます。'],
        ['クリックで編み目を追加', '<b>Enter</b>（または<b>+ 新しい段</b>）で2段目を始め、上部の記号バーの記号をクリックします。1回のクリックで、前段の次の目に1目編み入れます。点滅する丸が次に編み入れる位置です。ヒント：<b>inc</b>を1回クリックしてから<b>最後まで繰り返す</b>を押すと、段全体が埋まります。'],
        ['文字で入力する', '右側の各段には入力欄があります。<code>(sc, inc) x</code> と入力して Enter を押すと、かっこの中が段の終わりまで繰り返されます。前段の目をちょうど使い切ると目数が緑色の ✓ になり、過不足があるときは「残り3」「2超過」と表示されます。'],
        ['長い編み目・くさり・松編みを組み合わせる', '背の高い編み目に合わせて段は自動的に広がります。<code>sch 3</code> は1目に数える立ち上がりのくさり3目、<code>[dc 2, ch 2, dc 2]</code> は1つの目に編み入れる松編み、<code>sk 2</code> は2目とばす、<code>join</code> は引き抜き編みで段を閉じます。'],
        ['修正と色付け', '編み図上の編み目をクリックすると選択され、新しい編み目はそのすぐ後に追加されます。<b>⌫</b> で削除、右パネルの色ボックスでその目の色を変更、各段の横の色の丸で段全体の色を変更できます。<b>Ctrl+Z</b> で元に戻せます。<b>手動で微調整</b>のスライダーで選択した目の傾き・長さ・位置を調整でき、コピー／貼り付けで模様を繰り返せます。'],
      ],
      tourH: '画面の見かた',
      tour: ['<b>記号パレット</b> — クリックで編み目を追加。カーソルを合わせると名前と略語が表示されます。',
        '<b>編み図</b> — ドラッグで移動、スクロールで拡大縮小、編み目をクリックして選択。',
        '<b>段リスト</b> — 1段につき1行：色、入力した編み方、目数。行をクリックするとその段を編集できます。',
        '<b>上部バー</b> — 元に戻す／やり直す、拡大縮小、記号スタイル、言語、保存／開く、書き出し。',
        '<b>ヒント</b> — いまの段にあと何が必要かを表示します。'],
      rowsH: 'かぎ針編み・往復編み',
      rowsP: '使い方は同じですが、くさりの作り目から始めます。実際の編み方と同じく段ごとに向きが変わるので、各段の最初に立ち上がりのくさりを入れます。こま編みの前は <code>tch 1</code>（1目に数えない）、長編みの前は <code>sch 3</code>（1目に数える）です。',
      cheatH: '入力できる書き方',
      knitH: '棒針編みの編み図',
      knit: ['トップページで<b>棒針編みの編み図</b>を選び、目数と段数を決めます。サイズは後から右パネルで変更できます。',
        '上部のバーで記号を選び、<b>マス目の上をドラッグ</b>して描きます。消しゴムはマスを表目に戻します。',
        '交差編みは複数の目にまたがります。記号を選んで、置きたい場所を1回クリックします。',
        '色を選んでドラッグすると編み込み模様を描けます。記号は色の上に表示されます。',
        '右パネルに各段の編み方が文章で表示されます。表側の段は右から、裏側の段は左から読むため、裏側の段では表目の記号が「p」と書かれます。輪に編む場合は<b>輪編み</b>を選びます。',
        '上部バーの記号メニューで、JIS記号（ | — ）と欧米式（空白と •）を切り替えられます。',
        'スクロールで移動、<kbd>Ctrl</kbd>/<kbd>⌘</kbd>＋スクロールで拡大縮小、<kbd>Space</kbd>＋ドラッグで移動。'],
      saveH: '保存・開く・書き出し',
      save: ['すべての編み図はこのブラウザに自動保存され、トップページの<b>保存した編み図</b>に一覧表示されます。<b>← ホーム</b>でトップページに戻れます。',
        '<b>保存</b>で、手元に残したり人に送ったりできるファイルをダウンロードします。<b>開く</b>で読み込みます。',
        '<b>書き出し → 印刷・PDF</b>で、編み図・使用した記号の一覧・編み方の文章をまとめたシートを作れます。PNG と SVG は編み図だけを書き出します。'],
      keysH: 'キーボードショートカット（かぎ針編み）',
      keys: [['Enter', '新しい段を始める'], ['⌫ / Delete', '選択中の編み目、または最後の編み目を削除'], ['← →', '段の中で選択を移動'],
        ['Shift＋記号をクリック', '直前の編み目と同じ目に編み入れる'], ['Esc', '選択を解除'], ['Ctrl/⌘ + Z', '元に戻す'], ['Ctrl/⌘ + Shift + Z', 'やり直す']],
    },
    zh: {
      title: '使用說明', back: '← 回到工具',
      intro: '這個網站會替你畫出鉤針與棒針的織圖。你只要指定每一圈／段要織哪些針，織圖就會自動排版、計算針數，並寫出文字說明。資料不會上傳，只會儲存在這個瀏覽器裡。',
      modesH: '四種織圖',
      crochetH: '鉤針：五個步驟完成第一張織圖',
      steps: [
        ['開始一張織圖', '在首頁選擇<b>鉤針・環狀編織</b>，選擇第一圈的針法與針數，按下<b>開始</b>。第 1 圈會出現在環的周圍。'],
        ['用點選加入針法', '按 <b>Enter</b>（或<b>+ 新增一圈</b>）開始第 2 圈，再點選上方針法列的針法。每點一次，就會在前一圈的下一針織入一針，閃爍的圓圈標示下一針的位置。小技巧：點一次 <b>inc</b>，再按<b>重複到結尾</b>，整圈就會填滿。'],
        ['或是直接輸入', '右側每一圈都有一個輸入欄。輸入 <code>(sc, inc) x</code> 後按 Enter，括號內的內容會重複到這一圈結束。剛好用完前一圈的針數時，計數會變成綠色的 ✓；不足或超出時會顯示「剩 3」或「超出 2」。'],
        ['混用長針、鎖針與貝殼針', '每一圈會依較高的針法自動加寬。<code>sch 3</code> 是算作一針的立起鎖針 3 針，<code>[dc 2, ch 2, dc 2]</code> 是把整組貝殼針織入同一針，<code>sk 2</code> 是跳過 2 針，<code>join</code> 則以引拔針接合這一圈。'],
        ['修改與上色', '點選織圖上的任何一針即可選取，新加入的針會接在它後面。<b>⌫</b> 可刪除，右側面板的顏色方塊可更改這一針的顏色，每一圈旁的色點可更改整圈的顏色。<b>Ctrl+Z</b> 可復原任何操作。<b>手動微調</b>的滑桿可調整所選針目的角度、長度與位置，複製／貼上則可重複花樣。'],
      ],
      tourH: '畫面介紹',
      tour: ['<b>針法面板</b> — 點選即可加入針法。將游標移上去可看到名稱與縮寫。',
        '<b>織圖</b> — 拖曳移動、捲動縮放、點選針目以選取。',
        '<b>圈數清單</b> — 每圈一行：顏色、輸入的織法、針數。點選某一行即可編輯那一圈。',
        '<b>上方工具列</b> — 復原／重做、縮放、符號樣式、語言、儲存／開啟、匯出。',
        '<b>提示</b> — 告訴你目前這一圈還需要什麼。'],
      rowsH: '鉤針・往返編織',
      rowsP: '用法相同，但從鎖針起針開始。和實際編織一樣，每一段方向會交替，所以每段開頭要先織立起鎖針：短針前用 <code>tch 1</code>（不算針數），長針前用 <code>sch 3</code>（算一針）。',
      cheatH: '可以輸入的寫法',
      knitH: '棒針織圖',
      knit: ['在首頁選擇<b>棒針織圖</b>，設定針數與段數。之後可在右側面板更改尺寸。',
        '在上方選一個符號，然後<b>在方格上拖曳</b>即可繪製。橡皮擦會把格子還原成下針。',
        '麻花會橫跨多針：選好後，在要放的位置點一下即可。',
        '選一個顏色後拖曳，就能畫配色圖案；符號會顯示在顏色之上。',
        '右側面板會寫出每一段的織法。正面段由右向左看、反面段由左向右看，所以下針符號在反面段會寫成「p」。如果是圈織，請選擇<b>環狀編</b>。',
        '上方工具列的符號選單可切換 JIS 符號（ | — ）與歐美式（空白與 •）。',
        '捲動可移動畫面，<kbd>Ctrl</kbd>/<kbd>⌘</kbd>＋捲動縮放，<kbd>Space</kbd>＋拖曳平移。'],
      saveH: '儲存、開啟與匯出',
      save: ['所有織圖都會自動儲存在這個瀏覽器，並列在首頁的<b>我的織圖</b>中。按<b>← 首頁</b>即可回到首頁。',
        '<b>儲存</b>會下載一個可以保存或傳給別人的檔案；<b>開啟</b>可再次載入。',
        '<b>匯出 → 列印／PDF</b>會產生包含織圖、所用符號表與文字說明的頁面。PNG 與 SVG 則只匯出織圖。'],
      keysH: '鍵盤快速鍵（鉤針）',
      keys: [['Enter', '開始新的一圈／段'], ['⌫ / Delete', '刪除已選取的針，或最後一針'], ['← →', '在同一圈內移動選取'],
        ['Shift＋點選針法', '織入與前一針相同的針目'], ['Esc', '取消選取'], ['Ctrl/⌘ + Z', '復原'], ['Ctrl/⌘ + Shift + Z', '重做']],
    },
  };

  // What each step's illustration shows: rows typed so far (the last one is the round being discussed).
  const DOILY = ['sc 6', 'inc 6', '(sc, inc) x', 'sch 3, (dc 2, [dc 2]) x5, dc, [dc 2], join', '(sc, ch 3, sk) x', '(sk 2, [dc 2, ch 2, dc 2], sk) x'];
  const STEP_ART = [
    { rows: ['tch 1, sc 6, join'] },
    { rows: ['sc 6', 'inc 2'], live: true },
    { rows: DOILY.slice(0, 3) },
    { rows: DOILY },
    { rows: DOILY, sel: { r: 3, i: 6 }, colors: { 4: '#c0562b' } },
  ];
  // Callout positions (% of the screenshot) for the editor tour.
  const SPOTS = [[41, 24.5], [22, 36], [73, 44], [29, 4], [16.5, 93.5]];

  /** Draws a crochet chart from typed rows using the real engine. */
  function chart(shape, rows, o = {}) {
    const doc = { shape, chain: o.chain, guides: true, rows: [] };
    rows.forEach((txt, i) => {
      doc.rows.push({ ops: [] });
      doc.rows[i].ops = Crochet.parse(txt, Crochet.layout(doc).rows[i].pc);
      if (o.colors && o.colors[i]) doc.rows[i].color = o.colors[i];
    });
    const L = Crochet.layout(doc), b = L.bounds, R = L.rows[rows.length - 1];
    const status = !isFinite(R.pc) ? I18N.t('nSts', R.count) : R.used === R.pc ? `${R.count} ✓` : I18N.t('nLeft', R.pc - R.used);
    return `<figure class="art"><svg viewBox="${b.x + 12} ${b.y + 12} ${b.w - 24} ${b.h - 24}">${Crochet.render(doc, L, { exporting: !o.live, active: rows.length - 1, sel: o.sel })}</svg>
      <figcaption><b>${rows.length}</b> <code>${Crochet.toText(doc.rows[rows.length - 1].ops)}</code> <span class="${R.used === R.pc ? 'ok' : ''}">${status}</span></figcaption></figure>`;
  }
  const shot = (name, withSpots) => `<figure class="shot"><div class="shot-box"><img src="guide/${name}-${cfg.lang}.jpg?v=5" alt="" loading="lazy">`
    + (withSpots ? SPOTS.map(([x, y], i) => `<span class="spot" style="left:${x}%;top:${y}%">${i + 1}</span>`).join('') : '') + '</div></figure>';

  function render() {
    I18N.set(cfg.lang);
    const g = G[cfg.lang], t = I18N.t;
    document.documentElement.lang = cfg.lang === 'zh' ? 'zh-Hant' : cfg.lang;
    document.title = g.title;
    const ex = [['sc 6', 'h1'], ['inc', 'h2'], ['(sc 2, inc) x6', 'h3'], ['(sc, inc) x', 'h4'], ['[dc 2, ch 2, dc 2]', 'h5'],
      ['ch 3', 'h6'], ['sk 2', 'h7'], ['sch 3', 'h8'], ['tch 1', 'h9'], ['join', 'h10']];
    $('#guide').innerHTML = `
      <header class="g-top"><a class="btn" href="index.html">${g.back}</a>
        <select id="gLang" class="btn"><option value="en">English</option><option value="ja">日本語</option><option value="zh">繁體中文</option></select></header>
      <h1>${g.title}</h1><p class="lead">${g.intro}</p>
      <nav class="g-nav">${[['crochet', g.crochetH], ['tour', g.tourH], ['rows', g.rowsH], ['cheat', g.cheatH], ['knit', g.knitH], ['save', g.saveH], ['keys', g.keysH]]
        .map(([id, h]) => `<a href="#${id}">${h}</a>`).join('')}</nav>

      <h2>${g.modesH}</h2>
      <div class="g-modes">${[['mRound', 'mRoundP'], ['mOval', 'mOvalP'], ['mRows', 'mRowsP'], ['mKnit', 'mKnitP']].map(([a, b]) => `<div><b>${t(a)}</b><span>${t(b)}</span></div>`).join('')}</div>

      <h2 id="crochet">${g.crochetH}</h2>
      ${g.steps.map(([h, p], i) => `<section class="step"><div><span class="n">${i + 1}</span><h3>${h}</h3><p>${p}</p></div>${chart('round', STEP_ART[i].rows, STEP_ART[i])}</section>`).join('')}

      <h2 id="tour">${g.tourH}</h2>
      ${shot('crochet', true)}
      <ol class="tour">${g.tour.map(x => `<li>${x}</li>`).join('')}</ol>

      <h2 id="rows">${g.rowsH}</h2>
      <section class="step"><div><p>${g.rowsP}</p></div>${chart('rows', ['tch 1, sc 12', 'sch 3, dc 11', 'tch 1, (sc, ch 2, sk 2) x'], { chain: 12 })}</section>

      <h2 id="cheat">${g.cheatH}</h2>
      <table class="g-table">${ex.map(([c, k]) => `<tr><td><code>${c}</code></td><td>${t(k)}</td></tr>`).join('')}</table>
      <p class="note">${t('abbrNote')}</p>

      <h2 id="knit">${g.knitH}</h2>
      ${shot('knit')}
      <ol class="tour plain">${g.knit.map(x => `<li>${x}</li>`).join('')}</ol>

      <h2 id="save">${g.saveH}</h2>
      <ul class="g-list">${g.save.map(x => `<li>${x}</li>`).join('')}</ul>

      <h2 id="keys">${g.keysH}</h2>
      <table class="g-table">${g.keys.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>
      <p class="g-foot"><a class="btn primary" href="index.html">${g.back}</a></p>`;
    $('#gLang').value = cfg.lang;
    $('#gLang').onchange = e => {
      cfg.lang = e.target.value;
      try { localStorage.setItem('pm.cfg', JSON.stringify(cfg)); } catch { /* storage unavailable */ }
      render();
    };
  }
  render();
})();
