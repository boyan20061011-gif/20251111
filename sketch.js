let sidebarWidth = 180;
let sidebarX = -sidebarWidth;
let sidebarTargetX = -sidebarWidth;
let hoverThreshold = 20; // 靠左多少像素就會開始顯示

let currentPage = '主頁';

// 生動背景（更新）：粒子系統（隨機移動、靠近滑鼠變亮、彼此接線）
let particles = [];
const PARTICLE_COUNT = 80;
const PARTICLE_MAX_SPEED = 1.2;
const CONNECT_DIST = 90; // 粒子間連線最遠距離
const MOUSE_EFFECT_DIST = 160; // 滑鼠影響範圍

// 測驗相關
let questions = [];      // 完整題庫
let quizQuestions = [];  // 本次測驗要用的題目（隨機抽取最多 10 題）
let currentQ = 0;
let userAnswer = -1;
let showAnswerFeedback = false;
const QUIZ_COUNT = 10; // 每次測驗出題數量上限

let score = 0;          // 計分
let quizFinished = false; // 是否已完成測驗

// 簡單 CSV（第一列為欄位標頭）
let csvData = `問題,選項A,選項B,選項C,選項D,答案
1+1 等於多少?,1,2,3,4,1
臺灣的首都是哪一個城市?,新北市,台中,台北,高雄,2
p5.js 中用來畫畫的函式是?,setup,draw,createCanvas,mousePressed,1
HTML5 的標記語言是?,CSS,Python,HTML,Java,2
5-2 等於多少?,1,2,3,4,2
太陽系最大行星？,地球,火星,木星,金星,2
二進位的 10 等於十進位多少?,1,2,3,4,2
JS 用來選取 DOM 的函式是?,getElementById,query,select,find,0
CSS 用來改變字體大小的屬性是?,color,font-size,margin,padding,1
HTTP 狀態 404 代表?,伺服器錯誤,找不到,成功,未授權,1
`;

// 解析簡單 CSV（不處理帶逗號的欄位）
function parseCSV(text) {
  let lines = text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
  if (lines.length <= 1) return [];
  let out = [];
  for (let i = 1; i < lines.length; i++) {
    let parts = lines[i].split(',');
    if (parts.length < 6) continue;
    let q = parts[0];
    let choices = parts.slice(1, 5);
    let ans = parseInt(parts[5]);
    if (isNaN(ans)) ans = 0;
    out.push({ q: q, choices: choices, answer: ans });
  }
  return out;
}

// Fisher–Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function setup() {
  // 全螢幕（視窗大小）
  createCanvas(windowWidth, windowHeight);
  textFont('Arial');
  questions = parseCSV(csvData);

  initParticles();
}

// 初始化或重新配置粒子（在 resize 時呼叫）
function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-PARTICLE_MAX_SPEED, PARTICLE_MAX_SPEED),
      vy: random(-PARTICLE_MAX_SPEED, PARTICLE_MAX_SPEED),
      baseSize: random(2.5, 6),
      size: 0,
      brightness: 80
    });
  }
}

// 處理視窗大小變動
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新初始化粒子位置以配合新尺寸
  initParticles();
}

// 新的主頁背景：粒子隨機移動、靠近滑鼠變亮、彼此靠近會連線
function drawHomeBackground() {
  // 底色：柔和漸層
  let t = frameCount * 0.0015;
  for (let y = 0; y < height; y++) {
    let n = noise(y * 0.01, t);
    let r = lerp(20, 90, n);
    let g = lerp(60, 160, noise(y * 0.012, t + 10));
    let b = lerp(120, 240, noise(y * 0.008, t + 20));
    stroke(r, g, b);
    line(0, y, width, y);
  }

  noStroke();

  // 更新粒子位置與速度（加入些微隨機擾動）
  for (let p of particles) {
    // 隨機微加速度使路徑較自然
    p.vx += random(-0.15, 0.15);
    p.vy += random(-0.15, 0.15);

    // 限制速度
    p.vx = constrain(p.vx, -PARTICLE_MAX_SPEED, PARTICLE_MAX_SPEED);
    p.vy = constrain(p.vy, -PARTICLE_MAX_SPEED, PARTICLE_MAX_SPEED);

    p.x += p.vx;
    p.y += p.vy;

    // 環繞邊界（wrap）
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;

    // 計算與滑鼠距離的亮度因子（靠近滑鼠越亮）
    let dMouse = dist(p.x, p.y, mouseX, mouseY);
    let m = constrain(map(dMouse, 0, MOUSE_EFFECT_DIST, 1, 0), 0, 1); // 1=近,0=遠

    // 粒子尺寸與亮度跟滑鼠距離相關
    p.size = lerp(p.baseSize * 0.6, p.baseSize * 2.2, m);
    p.brightness = lerp(80, 255, m); // 用於填色 alpha 或亮度
  }

  // 畫連線：粒子之間距離小於 CONNECT_DIST 時畫線，線的透明度依距離與滑鼠影響
  strokeWeight(1);
  for (let i = 0; i < particles.length; i++) {
    let a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      let b = particles[j];
      let d = dist(a.x, a.y, b.x, b.y);
      if (d <= CONNECT_DIST) {
        // 線透明度受距離與滑鼠影響（若連線的兩點靠滑鼠都近則更亮）
        let midx = (a.x + b.x) / 2;
        let midy = (a.y + b.y) / 2;
        let dMouseMid = dist(midx, midy, mouseX, mouseY);
        let mMid = constrain(map(dMouseMid, 0, MOUSE_EFFECT_DIST, 1, 0), 0, 1);

        let alpha = map(d, 0, CONNECT_DIST, 220, 8) * (0.6 + 0.6 * mMid);
        stroke(200, 220, 255, alpha);
        line(a.x, a.y, b.x, b.y);
      }
    }
  }

  // 畫粒子（填色依據 brightness）
  noStroke();
  for (let p of particles) {
    let bright = p.brightness || 80;
    fill(255, 255, 255, bright * 0.9);
    ellipse(p.x, p.y, p.size);

    // 小高光
    fill(255, 255, 255, bright * 0.45);
    ellipse(p.x - p.size * 0.18, p.y - p.size * 0.18, p.size * 0.4);
  }
}

function draw() {
  // 主頁顯示特效背景，其他頁面使用單色背景
  if (currentPage === '主頁') {
    drawHomeBackground();
  } else {
    background(250);
  }

  // Header bar
  noStroke();
  fill(30, 144, 255); // 深藍
  rect(0, 0, width, 60);

  // Header text "主頁" or current page label
  fill(255);
  textSize(24);
  textAlign(CENTER, CENTER);
  text(currentPage, width / 2, 30);

  // 主頁中間顯示姓名與系別
  if (currentPage === '主頁') {
    fill(30);
    textSize(64); // 調大中間文字
    textAlign(CENTER, CENTER);
    textLeading(72);
    text('教育科技系\n414730654 魏伯諺', width / 2, height / 2);
  }

  // 決定菜單目標位置：當滑鼠靠近左側或滑鼠在菜單內時顯示
  let mouseInSidebarArea = (mouseX >= 0 && mouseX <= sidebarWidth && mouseY >= 0 && mouseY <= height);
  if (mouseX <= hoverThreshold || mouseInSidebarArea) {
    sidebarTargetX = 0;
  } else {
    sidebarTargetX = -sidebarWidth;
  }

  // 平滑動畫移動
  sidebarX = lerp(sidebarX, sidebarTargetX, 0.2);

  // 畫出側邊菜單（在畫面上層）
  push();
  translate(sidebarX, 0);
  noStroke();
  fill(45, 45, 48); // 菜單背景色
  rect(0, 0, sidebarWidth, height);

  // 菜單標題
  fill(255);
  textSize(18);
  textAlign(LEFT, CENTER);
  text('選單', 20, 40);

  // 菜單項目（新增「淡江大學」）
  textSize(16);
  let items = ['主頁', '測驗', '筆記', '作業', '淡江大學'];
  for (let i = 0; i < items.length; i++) {
    let y = 80 + i * 40;
    fill(200);
    text(items[i], 20, y);
  }
  pop();

  // 根據目前頁面畫內容
  if (currentPage === '測驗') {
    drawQuizPage();
  }
}

function drawQuizPage() {
  // 簡單版的測驗 UI
  fill(245);
  stroke(200);
  rect(100, 80, width - 120, height - 120, 6);
  noStroke();

  if (quizQuestions.length === 0) {
    fill(80);
    textSize(16);
    textAlign(LEFT, TOP);
    text('尚無題目。', 120, 100);
    return;
  }

  // 如果已完成測驗，顯示分數結果與按鈕
  if (quizFinished) {
    fill(30);
    textSize(20);
    textAlign(LEFT, TOP);
    text('測驗完成', 120, 100);
    textSize(16);
    text('得分：' + score + ' / ' + quizQuestions.length, 120, 140);

    // 重新測驗按鈕
    let bx = 120;
    let by = 200;
    let bw = 140;
    let bh = 36;
    fill(100, 200, 255);
    rect(bx, by, bw, bh, 6);
    fill(30);
    textAlign(CENTER, CENTER);
    text('重新測驗', bx + bw / 2, by + bh / 2);

    // 回主頁按鈕
    let bx2 = bx + bw + 20;
    let by2 = by;
    let bw2 = 100;
    fill(200);
    rect(bx2, by2, bw2, bh, 6);
    fill(30);
    textAlign(CENTER, CENTER);
    text('回主頁', bx2 + bw2 / 2, by2 + bh / 2);
    return;
  }

  let qObj = quizQuestions[currentQ];
  fill(30);
  textSize(18);
  textAlign(LEFT, TOP);
  text('題目 ' + (currentQ + 1) + '/' + quizQuestions.length, 120, 92);
  textSize(16);
  text(qObj.q, 120, 120, width - 150);

  // 選項按鈕
  textSize(15);
  let startY = 170;
  for (let i = 0; i < qObj.choices.length; i++) {
    let bx = 120;
    let by = startY + i * 40;
    let bw = width - 160;
    let bh = 32;

    // 根據選取與回饋變換顏色
    if (showAnswerFeedback) {
      if (i === qObj.answer) {
        fill(100, 200, 100); // 正確為綠
      } else if (i === userAnswer) {
        fill(240, 100, 100); // 選錯為紅
      } else {
        fill(220);
      }
    } else {
      if (i === userAnswer) fill(180, 220, 255);
      else fill(220);
    }

    stroke(180);
    rect(bx, by, bw, bh, 4);
    noStroke();
    fill(30);
    textAlign(LEFT, CENTER);
    text(qObj.choices[i], bx + 10, by + bh / 2);
  }

  // 顯示回饋文字與下一題按鈕
  if (showAnswerFeedback) {
    let correct = (userAnswer === qObj.answer);
    fill(30);
    textSize(14);
    textAlign(LEFT, TOP);
    text(correct ? '回答正確！' : '回答錯誤', 120, startY + 4 * 40 + 10);

    // 下一題按鈕
    let nx = 120;
    let ny = startY + 4 * 40 + 40;
    let nw = 120;
    let nh = 32;
    fill(100, 200, 255);
    rect(nx, ny, nw, nh, 4);
    fill(30);
    textAlign(CENTER, CENTER);
    // 如果是最後一題，改為「結束」
    if (currentQ === quizQuestions.length - 1) text('結束', nx + nw / 2, ny + nh / 2);
    else text('下一題', nx + nw / 2, ny + nh / 2);
  } else {
    // 提示
    fill(120);
    textSize(13);
    textAlign(LEFT, TOP);
    text('請點選一個選項以作答。', 120, startY + 4 * 40 + 10);
  }
}

function mousePressed() {
  // 先判斷是否點到側邊選單（座標需轉換）
  let localX = mouseX - sidebarX;
  if (localX >= 0 && localX <= sidebarWidth && mouseY >= 0 && mouseY <= height) {
    // 檢查是哪個選單項目被點
    let items = ['主頁', '測驗', '筆記', '作業', '淡江大學'];
    for (let i = 0; i < items.length; i++) {
      let y = 80 + i * 40;
      if (mouseY >= y - 10 && mouseY <= y + 10) {
        // 若為淡江大學則開新分頁
        if (items[i] === '淡江大學') {
          window.open('https://www.tku.edu.tw/', '_blank');
          return;
        }
        // 若為筆記則開 HackMD 連結
        if (items[i] === '筆記') {
          window.open('https://hackmd.io/@7nV8IGwpT6yOwHnn4_02iw/HJh_YdJhll', '_blank');
          return;
        }
        // 若為作業則開指定連結
        if (items[i] === '作業') {
          window.open('https://boyan20061011-gif.github.io/414730654/', '_blank');
          return;
        }

        currentPage = items[i];
        // 重設測驗狀態（切到測驗時）
        if (currentPage === '測驗') {
          // 從完整題庫隨機抽取最多 QUIZ_COUNT 題
          if (questions.length > 0) {
            let pool = questions.slice(); // 複製
            shuffleArray(pool);
            quizQuestions = pool.slice(0, Math.min(QUIZ_COUNT, pool.length));
          } else {
            quizQuestions = [];
          }
          currentQ = 0;
          userAnswer = -1;
          showAnswerFeedback = false;
          score = 0;
          quizFinished = false;
        }
      }
    }
    return;
  }

  // 如果在測驗分頁
  if (currentPage === '測驗') {
    // 若已完成測驗，處理重新測驗 / 回主頁按鈕
    if (quizFinished) {
      // 重新測驗按鈕區域
      let bx = 120;
      let by = 200;
      let bw = 140;
      let bh = 36;
      if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
        // 重新抽題並重設
        if (questions.length > 0) {
          let pool = questions.slice();
          shuffleArray(pool);
          quizQuestions = pool.slice(0, Math.min(QUIZ_COUNT, pool.length));
        } else {
          quizQuestions = [];
        }
        currentQ = 0;
        userAnswer = -1;
        showAnswerFeedback = false;
        score = 0;
        quizFinished = false;
        return;
      }
      // 回主頁按鈕
      let bx2 = 120 + 140 + 20;
      let by2 = 200;
      let bw2 = 100;
      let bh2 = 36;
      if (mouseX >= bx2 && mouseX <= bx2 + bw2 && mouseY >= by2 && mouseY <= by2 + bh2) {
        currentPage = '主頁';
        return;
      }
      return;
    }

    // 正常作答流程
    if (quizQuestions.length > 0) {
      let qObj = quizQuestions[currentQ];
      let startY = 170;
      // 點選選項
      for (let i = 0; i < qObj.choices.length; i++) {
        let bx = 120;
        let by = startY + i * 40;
        let bw = width - 160;
        let bh = 32;
        if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
          if (!showAnswerFeedback) {
            userAnswer = i;
            showAnswerFeedback = true;
          }
          return;
        }
      }

      // 下一題或結束按鈕
      if (showAnswerFeedback) {
        let nx = 120;
        let ny = startY + 4 * 40 + 40;
        let nw = 120;
        let nh = 32;
        if (mouseX >= nx && mouseX <= nx + nw && mouseY >= ny && mouseY <= ny + nh) {
          // 計分（只在按下一題時計）
          if (userAnswer === qObj.answer) score++;
          // 如果是最後一題，結束測驗
          if (currentQ === quizQuestions.length - 1) {
            quizFinished = true;
          } else {
            currentQ++;
            userAnswer = -1;
            showAnswerFeedback = false;
          }
          return;
        }
      }
    }
  }
}