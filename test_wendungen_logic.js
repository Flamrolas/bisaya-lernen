const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const m = html.match(/const PHRASES_VOCAB\s*=\s*(\[[\s\S]*?\n\];)/);
const PHRASES_VOCAB = eval("(" + m[1].slice(0, -1) + ")");

function shuffleArr(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function promptAndAnswer(item, mode){
  if(mode==="learn-de") return { prompt: item.bis, answer: item.de, promptLang:"bis" };
  const isEn = mode==="learn-bis-en";
  return { prompt: isEn ? (item.en||item.de) : item.de, answer: item.bis, promptLang: isEn ? "en" : "de" };
}
function buildQuizCard(pool, fullPool, mode, QUESTIONS_PER_CARD){
  const shuffled = shuffleArr(pool);
  const chosen = shuffled.slice(0, QUESTIONS_PER_CARD);
  return chosen.map(item=>{
    const pa = promptAndAnswer(item, mode);
    const seen = new Set([pa.answer]);
    const distractors = [];
    const sameCat = shuffleArr(fullPool.filter(d=>d.cat===item.cat && d!==item));
    for(const d of sameCat){
      const dAnswer = promptAndAnswer(d, mode).answer;
      if(!dAnswer || seen.has(dAnswer)) continue;
      seen.add(dAnswer); distractors.push(dAnswer);
      if(distractors.length>=3) break;
    }
    if(distractors.length < 3){
      const anyPool = shuffleArr(fullPool.filter(d=>d!==item));
      for(const d of anyPool){
        const dAnswer = promptAndAnswer(d, mode).answer;
        if(!dAnswer || seen.has(dAnswer)) continue;
        seen.add(dAnswer); distractors.push(dAnswer);
        if(distractors.length>=3) break;
      }
    }
    const options = shuffleArr([pa.answer, ...distractors]);
    return { prompt: pa.prompt, correct: pa.answer, options };
  }).filter(q=>q.options.length>=2);
}

const cats = ["Alltagsphrasen","Redewendungen","Slang & Jugendsprache"];
console.log("Total PHRASES_VOCAB:", PHRASES_VOCAB.length);
cats.forEach(c=>console.log(" -", c, ":", PHRASES_VOCAB.filter(p=>p.cat===c).length));
const uncategorized = PHRASES_VOCAB.filter(p=>!cats.includes(p.cat));
console.log("Uncategorized entries (should be 0):", uncategorized.length, uncategorized.slice(0,5));

// stress test: build 200 quiz cards for each mode x each category(+alle), check option counts & duplicates
const modes = ["learn-bis","learn-bis-en","learn-de"];
let problems = 0;
modes.forEach(mode=>{
  [...cats, "alle"].forEach(cat=>{
    const pool = cat==="alle" ? PHRASES_VOCAB : PHRASES_VOCAB.filter(p=>p.cat===cat);
    if(pool.length < 4) { console.log(`SKIP ${mode}/${cat}: pool too small (${pool.length})`); return; }
    for(let i=0;i<50;i++){
      const card = buildQuizCard(pool, PHRASES_VOCAB, mode, 6);
      card.forEach(q=>{
        if(!q.options.includes(q.correct)){ console.log("BUG: correct answer missing from options", mode, cat, q); problems++; }
        const uniq = new Set(q.options);
        if(uniq.size !== q.options.length){ console.log("BUG: duplicate options", mode, cat, q); problems++; }
        if(q.options.length < 2){ console.log("BUG: too few options", mode, cat, q); problems++; }
      });
    }
  });
});
console.log("Total problems found:", problems);

// check every entry has a .bis key usable in state.words (non-empty, unique enough)
const bisKeys = PHRASES_VOCAB.map(p=>p.bis);
const dupBis = bisKeys.filter((v,i,a)=>a.indexOf(v)!==i);
console.log("Duplicate .bis keys within PHRASES_VOCAB (would collide in state.words):", [...new Set(dupBis)]);
