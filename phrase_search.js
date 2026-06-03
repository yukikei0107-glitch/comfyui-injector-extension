let phraseData = [];
let searchType = 'both';

// ファイル選択
document.getElementById('btn-select-file').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

// ファイル読込
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    phraseData = parseCSV(text);
    
    document.getElementById('file-name').textContent = `📄 ${file.name} (${phraseData.length}行)`;
    document.getElementById('status').textContent = `読込完了: ${phraseData.length}行`;
    document.getElementById('info').textContent = `✅ ${phraseData.length.toLocaleString()}行を読み込みました。キーワードで検索できます。`;
    document.getElementById('results').innerHTML = '<div class="empty-msg">検索してください</div>';
  } catch (err) {
    document.getElementById('status').textContent = 'エラー: ファイル読込失敗';
    alert('ファイルの読込に失敗しました: ' + err.message);
  }
});

// CSV解析
function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
  const data = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // カンマで分割（ダブルクォートエスケープ対応）
    let en = '';
    let jp = '';
    let inQuote = false;
    let field = '';
    let fields = [];
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuote && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field);
    
    if (fields.length < 2) continue;
    
    en = fields[0].replace(/^"|"$/g, '').trim();
    jp = fields[1].replace(/^"|"$/g, '').trim();
    
    if (!en || !jp) continue;
    
    // 複数の日本語翻訳を分割
    const translations = jp.split(',').map(t => t.trim()).filter(t => t);
    for (const trans of translations) {
      if (en && trans) {
        data.push({ jp: trans, en: en });
      }
    }
  }
  
  return data;
}

// 検索
document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    document.getElementById('results').innerHTML = '<div class="empty-msg">検索してください</div>';
    return;
  }
  
  const results = phraseData.filter(item => {
    const jpMatch = item.jp.toLowerCase().includes(query);
    const enMatch = item.en.toLowerCase().includes(query);
    
    if (searchType === 'jp') return jpMatch;
    if (searchType === 'en') return enMatch;
    return jpMatch || enMatch;
  });
  
  displayResults(results.slice(0, 100)); // 最大100件表示
});

// 検索タイプ切り替え
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    searchType = btn.dataset.type;
    
    // 再検索
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    if (query) {
      document.getElementById('search-input').dispatchEvent(new Event('input'));
    }
  });
});

// 結果表示
function displayResults(results) {
  const resultsEl = document.getElementById('results');
  
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="empty-msg">該当する結果がありません</div>';
    return;
  }
  
  resultsEl.innerHTML = results.map((item, idx) => `
    <div class="result-item">
      <div class="jp">${escapeHtml(item.jp)}</div>
      <div class="en">${escapeHtml(item.en)}</div>
      <button class="btn-use" data-idx="${idx}">▶ 使う</button>
    </div>
  `).join('');
  
  // 「使う」ボタンのイベント
  resultsEl.querySelectorAll('.btn-use').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const item = results[idx];
      
      // コントロール画面を探す
      const tabs = await new Promise(resolve =>
        chrome.tabs.query({ url: chrome.runtime.getURL('control.html') }, resolve)
      );
      
      if (tabs.length > 0) {
        // コントロール画面に送信
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SET_PROMPT',
          text: item.en
        });
        alert(`"${item.en}" をコントロール画面に送信しました`);
      } else {
        alert('コントロール画面を開いてください');
      }
    });
  });
}

// HTML エスケープ
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
