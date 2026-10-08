let audioCtx = null;
let sounds = {};

function initAudio(){

if(!audioCtx){
audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

}

async function loadSound(name, url){

let res = await fetch(url);
let arrayBuffer = await res.arrayBuffer();
let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

sounds[name] = audioBuffer;

}

function playSound(name){

if(!audioCtx || !sounds[name]) return;

// 🔥 FIX iPhone
if(audioCtx.state === "suspended"){
   audioCtx.resume();
}

let source = audioCtx.createBufferSource();
source.buffer = sounds[name];

source.connect(audioCtx.destination);
source.start(0);

}

let musicSource = null;

function playMusicLoop(){

// 🛑 si ya está sonando, no hacer nada
if(musicSource) return;

if(!audioCtx || !sounds["music"]) return;

if(audioCtx.state === "suspended"){
   audioCtx.resume();
}
   
musicSource = audioCtx.createBufferSource();
musicSource.buffer = sounds["music"];
musicSource.loop = true;

musicSource.connect(audioCtx.destination);
musicSource.start(0);

}

function stopMusic(){
if(musicSource){
musicSource.stop();
musicSource = null;
}
}

let playerNameInput = document.getElementById("playerName");

let playerName = "";

let roomCode="";

let playerId = localStorage.getItem("playerId");

let selectedPlayer = null;

if(!playerId){
   playerId = "player_" + Math.random().toString(36).substr(2,9);
   localStorage.setItem("playerId", playerId);
}

const canvas = document.getElementById("game");

const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");

const startBtn=document.getElementById("startBtn");

const startScreen=document.getElementById("startScreen");

let gameStarted=false;

let gamePaused = false;

let gameEnded = false;

// ===== QUIZ TIMER =====
let quizTimer;
let quizTimeLimit = 10;

let fallSpeed = 700; // velocidad normal

let speedIncreaseCount = 0; // cuántas veces aumentó velocidad
let maxSpeedIncreases = 3;  // máximo permitido

let speedPenalty = 22; // cuánto acelera cuando responde mal
let minSpeed = 400;     // velocidad mínima permitida

let lastSpeedChange = 0;

// ===== GAME TIMER (TIEMPO TOTAL DEL JUEGO) =====
let gameTimeLimit = 480; // 8 minutos
let gameTimer;
let gameTimeLeft;

let score=0;

let correctAnswers = 0;
let cleanRows = 0;

let firstTryScore = null;
let secondTryScore = null;
let currentTry = 1;

let lastPieceIndex = null;

let piecesForQuiz = 3;  // empieza cada 3 fichas
let pieceCounter = 0;   // contador de fichas

const COLS = 10;
const ROWS = 20;

let SIZE = 25;

// 🔥 Ajusta tamaño para móvil o PC
function resizeGame(){

let screenWidth = window.innerWidth;

if(screenWidth < 600){
// Celular: tablero más grande (~88% del ancho)
let targetWidth = Math.min(screenWidth * 0.88, 340);
SIZE = Math.max(14, Math.floor(targetWidth / COLS));
}else{
SIZE = 25; // PC
}

canvas.width = COLS * SIZE;
canvas.height = ROWS * SIZE;

}

// ejecutar al cargar
resizeGame();

// ejecutar si cambia tamaño pantalla
window.addEventListener("resize", resizeGame);

let board = Array.from({length:ROWS},()=>Array(COLS).fill(0));

const colors=[
null,
"cyan",
"yellow",
"purple",
"green",
"red",
"blue",
"orange"
];

const pieces=[

[[1,1,1,1]],

[[2,2],[2,2]],

[[0,3,0],[3,3,3]],

[[0,4,4],[4,4,0]],

[[5,5,0],[0,5,5]],

[[6,0,0],[6,6,6]],

[[0,0,7],[7,7,7]]

];

function drawSquare(x,y,color){

ctx.fillStyle=color;

ctx.fillRect(x*SIZE,y*SIZE,SIZE,SIZE);

ctx.strokeRect(x*SIZE,y*SIZE,SIZE,SIZE);

}

function drawGrid(){

for(let y=0; y<=ROWS; y++){
for(let x=0; x<=COLS; x++){

// brillo suave que cambia cada frame
let alpha = 0.2;

ctx.beginPath();
ctx.arc(
x*SIZE,   // esquina horizontal
y*SIZE,   // esquina vertical
1.5,
0,
Math.PI*2
);

ctx.fillStyle = "rgba(255,255,255,"+alpha+")";
ctx.fill();

}
}

}

function drawBoard(){

ctx.clearRect(0,0,canvas.width,canvas.height);

drawGrid(); // ⭐ dibuja estrellas primero

board.forEach((row,y)=>{
row.forEach((value,x)=>{
if(value){
drawSquare(x,y,colors[value]);
}
})
})

}

let piece=randomPiece();

function randomPiece(){

let newIndex;

do{
    newIndex = Math.floor(Math.random()*pieces.length);
}while(newIndex === lastPieceIndex);

lastPieceIndex = newIndex;

let baseShape = pieces[newIndex];

// 🔥 CLONAR forma
let newShape = baseShape.map(row => [...row]);

// 🎨 COLOR RANDOM
let randomColor = Math.floor(Math.random()*7) + 1;

newShape = newShape.map(row =>
    row.map(val => val ? randomColor : 0)
);

return{
    shape:newShape,
    x:3,
    y:0
}

}

function merge(){

if(gameEnded || gamePaused) return;

piece.shape.forEach((row,y)=>{

row.forEach((value,x)=>{

if(value){

// seguridad: no escribir fuera del tablero
if(y+piece.y >= 0 && y+piece.y < ROWS && x+piece.x >= 0 && x+piece.x < COLS){
board[y+piece.y][x+piece.x]=value;
}

}

})

})

pieceCounter++;

clearLines();

// Abrir quiz DESPUÉS de limpiar líneas (solo una vez)
if(!gameEnded && pieceCounter >= piecesForQuiz){
    pieceCounter = 0;
    showQuiz();
    return; // 🔥 no spawnear pieza ni continuar mientras hay quiz
}

if(gameEnded) return;

piece=randomPiece();

if(collide()){
gameOver();
}

}

// ===== BORRAR FILAS ESTILO TETRIS ===== 
function clearLines(){

for(let y = ROWS - 1; y >= 0; y--){

    if(board[y].every(value => value !== 0)){

        // 🔊 SONIDO
playSound("line");

        // ✨ EFECTO VISUAL
        canvas.style.boxShadow = "0 0 25px cyan";
        setTimeout(() => {
            canvas.style.boxShadow = "none";
        }, 120);

        // eliminar fila llena
        board.splice(y,1);

        // agregar nueva fila vacía arriba
        board.unshift(Array(COLS).fill(0));

        score+=15;
cleanRows++;
updateStats();

scoreText.innerText = score;

updateRanking();

        // Quiz se abre solo desde merge() para evitar dobles

        y++; // revisar misma fila otra vez
    }

}

}

function collide(){

return piece.shape.some((row,y)=>{

return row.some((value,x)=>{

return value && (

board[y+piece.y]?.[x+piece.x]!==0

)

})

})

}

function drawPiece(){

piece.shape.forEach((row,y)=>{

row.forEach((value,x)=>{

if(value){

ctx.fillStyle = colors[value];

ctx.fillRect(
(piece.x + x)*SIZE,
(piece.y + y)*SIZE,
SIZE,
SIZE
);

ctx.strokeRect(
(piece.x + x)*SIZE,
(piece.y + y)*SIZE,
SIZE,
SIZE
);

}

});

});

}

function update(){

// 🔥 Detener caída si el juego terminó o está en pausa (quiz)
if(gamePaused || gameEnded || !gameStarted) return;
    
// evita salir por izquierda
if(piece.x<0){
piece.x=0;
}

// evita salir por derecha
if(piece.x+piece.shape[0].length>COLS){
piece.x=COLS-piece.shape[0].length;
}

piece.y++;

if(collide()){
piece.y--;
merge();
}

if(gameEnded || gamePaused) return;

drawBoard();
drawPiece();
sendGameState();

}

let gameLoop;

function startGameLoop(){

// Nunca reiniciar el loop si el juego terminó o está en quiz
if(gameEnded || gamePaused) return;

if(gameLoop){
   clearInterval(gameLoop);
   gameLoop = null;
}

gameLoop = setInterval(update, fallSpeed);

}

startBtn.onclick = async () => {

let name = playerNameInput.value.trim();
let room = document.getElementById("roomCode").value.trim();

if(name==="" || room===""){
alert("⚠ Please write your Name AND Class Code");
return;
}

// 🎮 animación
startBtn.classList.add("startAnim");

// 🔥 1. INICIAR AUDIO
initAudio();

if(audioCtx.state === "suspended"){
    await audioCtx.resume();
}

// 🔓 desbloqueo iPhone (UNA SOLA VEZ)
let buffer = audioCtx.createBuffer(1, 1, 22050);
let source = audioCtx.createBufferSource();
source.buffer = buffer;
source.connect(audioCtx.destination);
source.start(0);

// 🔥 2. CARGAR TODOS LOS SONIDOS
await Promise.all([
    loadSound("start", "start.mp3"),
    loadSound("correct", "correct.mp3"),
    loadSound("wrong", "wrong.mp3"),
    loadSound("line", "lineclear.mp3"),
    loadSound("gameover", "gameover.mp3"),
    loadSound("victory", "victory.mp3"),
    loadSound("music", "music.mp3")
]);

// 🔥 3. REPRODUCIR (YA CARGADOS)
playSound("start");


// ⏳ NO TOCAR
setTimeout(()=>{

playerName = name
.trim()
.replace(/[.#$[\]]/g,"")
.replace(/\s+/g," ");

// Normalizar igual que el teacher (trim + mayúsculas)
roomCode = room.trim().toUpperCase();

activateRealtimeRanking();

// Registrar al jugador
registerPlayer();

waitForTeacher();

}, 1500);

};

// ---------- QUIZ ----------

const quiz=document.getElementById("quiz");

const questionText=document.getElementById("question");

const answers=document.getElementById("answers");

let questions=[];

async function loadQuestions(){

// 1) Intentar cargar desde Firebase (editor del teacher)
try {
  let snap = await firebase.database().ref("gameQuestions").once("value");
  let data = snap.val();

  if(data && Array.isArray(data) && data.length > 0){
    questions = data.map(q => ({
      q: q.q,
      a: [q.a[0], q.a[1], q.a[2]],
      correct: Number(q.correct)
    }));
    console.log("✅ Preguntas desde Firebase:", questions.length);
    return;
  }
} catch(e){
  console.log("⚠ No se pudo leer gameQuestions:", e);
}

// 2) Fallback: Google Sheets (por si aún no hay preguntas en Firebase)
try {
  let url="https://docs.google.com/spreadsheets/d/e/2PACX-1vSuZY8I3EBxrL3tML7ABICEOr2WxHuCi88co-0K0C_U7KBmqulqSHjuJnfSIrHayaVWsAEkKVmsK-mA/pub?output=csv";
  let res=await fetch(url);
  let text=await res.text();

  let rows = text
  .split("\n")
  .slice(1)
  .filter(r => r.trim() !== "");

  questions = rows.map(row => {
    let cols = row.split(",");
    return{
      q: cols[0],
      a: [cols[1], cols[2], cols[3]],
      correct: Number(cols[4])
    };
  });

  console.log("✅ Preguntas desde Sheets:", questions.length);
} catch(e){
  console.log("⚠ No se pudieron cargar preguntas:", e);
  questions = [];
}

}

loadQuestions();

// Escuchar cambios en vivo (si el teacher edita durante la clase)
firebase.database().ref("gameQuestions").on("value", snap => {
  let data = snap.val();
  if(data && Array.isArray(data) && data.length > 0){
    questions = data.map(q => ({
      q: q.q,
      a: [q.a[0], q.a[1], q.a[2]],
      correct: Number(q.correct)
    }));
    console.log("🔄 Preguntas actualizadas:", questions.length);
  }
});

function safeBase64(str){
   return btoa(unescape(encodeURIComponent(str)));
}

function showQuiz(){

if(gameEnded || gamePaused) return; // 🔴 evita preguntas después del game over o quiz doble

if(!questionOrder || questionOrder.length === 0){
   console.log("⚠ questionOrder aún no cargado");
   return;
}
   
// ✅ PROTECCIÓN 1: si no hay preguntas, no abrir quiz
if(!questions || questions.length === 0){
    console.log("⚠ No hay preguntas cargadas");
    return;
}

// 🔥 usar orden global
let index = questionOrder[currentQuestionIndex];

// seguridad
if(index === undefined){
    console.log("⚠ No hay más preguntas");
    return;
}

let q = questions[index];

// ✅ PROTECCIÓN 2: evitar error si algo salió mal
if(!q || !q.q || !q.a){
    console.log("⚠ Pregunta inválida:", q);
    return;
}

// pausa juego (solo si la pregunta es válida)
if(gameLoop){ clearInterval(gameLoop); gameLoop = null; }
if(quizTimer){ clearInterval(quizTimer); quizTimer = null; }

gamePaused = true;
    
quiz.classList.remove("hidden");
startQuizTimer();

currentQuizData = {
question: q.q,
answers: q.a,
selected: null,
correct: null
};

questionText.innerText = q.q;
answers.innerHTML = "";

q.a.forEach((ans,i)=>{

let b = document.createElement("button");
b.innerText = ans;

b.onclick = ()=>{

// 🟡 1. SELECCIÓN EN VIVO
currentQuizData.selected = i;
currentQuizData.correct = null; // aún no se sabe
sendGameState(); // 🔥 ENVÍA selección al instante

answers.innerHTML="";

let result=document.createElement("div");
result.className="answerResult";

if(i===q.correct){

clearInterval(quizTimer);

// 🟢 GUARDAR ESTADÍSTICA
let questionId = "q_" + safeBase64(q.q).replace(/=/g, "");

firebase.database()
.ref("rooms/"+roomCode+"/stats/"+questionId)
.transaction(data => {
   if(!data){
      return { 
         question: q.q, // 🔥 IMPORTANTE
         correct: 1, 
         wrong: 0 
      };
   }
   data.correct++;
   return data;
});
   
// 🟢 2. RESPUESTA CORRECTA
currentQuizData.correct = q.correct;
sendGameState(); // 🔥 ENVÍA resultado final

playSound("correct");

updateRanking();

score += 50;
correctAnswers++;
updateStats();

scoreText.innerText = score;

updateRanking();

piecesForQuiz = 4;

result.innerText="✅ CORRECT ANSWER";

}else{

clearInterval(quizTimer);

// 🔴 GUARDAR ESTADÍSTICA
let questionId = "q_" + safeBase64(q.q).replace(/=/g, "");

firebase.database()
.ref("rooms/"+roomCode+"/stats/"+questionId)
.transaction(data => {
   if(!data){
      return { 
         question: q.q, // 🔥 IMPORTANTE
         correct: 0, 
         wrong: 1 
      };
   }
   data.wrong++;
   return data;
});
   
// 🔴 2. RESPUESTA INCORRECTA
currentQuizData.correct = q.correct;
sendGameState(); // 🔥 ENVÍA resultado final

playSound("wrong");

// no restamos puntos
    
piecesForQuiz = 5;

// 🔥 acelerar caída (solo cambia velocidad; el loop se reinicia al cerrar el quiz)
if(speedIncreaseCount < maxSpeedIncreases){

   let now = Date.now();

   if(now - lastSpeedChange > 3000){

      fallSpeed -= speedPenalty;

      if(fallSpeed < minSpeed){
         fallSpeed = minSpeed;
      }

      speedIncreaseCount++;
      lastSpeedChange = now;
   }
}

result.innerText="❌ WRONG ANSWER";
}

answers.appendChild(result);

scoreText.innerText=score;

// 🔥 AVANZAR A LA SIGUIENTE PREGUNTA (GLOBAL)
firebase.database()
.ref("rooms/"+roomCode)
.transaction(data => {
   if(!data) return data;

   if(!data.questionIndex) data.questionIndex = 0;

   data.questionIndex++;

   return data;
});

setTimeout(()=>{

currentQuizData = null;
sendGameState(); // 🔥 LIMPIAR QUIZ EN TEACHER

quiz.classList.add("hidden");

// Solo reanudar si el juego sigue activo
if(gameEnded) return;

gamePaused = false;
startGameLoop();

},1500);
    
};

answers.appendChild(b);

});
}

function hideQuiz(){

quiz.classList.add("hidden");

// Nunca reanudar si el juego ya terminó
if(gameEnded) return;

gamePaused = false;
startGameLoop();

}

function startQuizTimer(){

let timeLeft = quizTimeLimit;

// limpiar timer anterior si existía
if(quizTimer){
  clearInterval(quizTimer);
  quizTimer = null;
}

let timerText = document.getElementById("quizTimerText");

if(timerText){
timerText.innerText = timeLeft;
}

quizTimer = setInterval(()=>{

timeLeft--;

if(timerText){
timerText.innerText = timeLeft;
}

// Si el juego terminó mientras había quiz, cerrar y salir
if(gameEnded){
  clearInterval(quizTimer);
  quizTimer = null;
  quiz.classList.add("hidden");
  return;
}

if(timeLeft <= 0){

clearInterval(quizTimer);
quizTimer = null;

// ❌ no respondió → aumenta velocidad (sin reiniciar loop aquí)
if(speedIncreaseCount < maxSpeedIncreases){

   let now = Date.now();

   if(now - lastSpeedChange > 3000){

      fallSpeed -= speedPenalty;

      if(fallSpeed < minSpeed){
         fallSpeed = minSpeed;
      }

      speedIncreaseCount++;
      lastSpeedChange = now;
   }
}

// avanzar índice de pregunta también al timeout
firebase.database()
.ref("rooms/"+roomCode)
.transaction(data => {
   if(!data) return data;
   if(!data.questionIndex) data.questionIndex = 0;
   data.questionIndex++;
   return data;
});

currentQuizData = null;
sendGameState();

hideQuiz();

}

},1000);

}

function playStartSound(callback){

startSound.currentTime = 0;
startSound.volume = 0.5;

startSound.play().catch(()=>{});

startSound.onended = function(){

if(callback){
callback();
}

};

}

function showIntroAnimation(){

let intro = document.createElement("div");

intro.id = "introScreen";

intro.innerHTML = "READY<br>PLAYER ONE";

document.body.appendChild(intro);

// quitar después de 2.5 segundos
setTimeout(()=>{
intro.remove();
},2500);

}

function startGameTimer(){

firebase.database()
.ref("rooms/"+roomCode)
.once("value", snapshot => {

let data = snapshot.val();
if(!data) return;

let start = data.startTime;
let limit = data.gameTime ? data.gameTime : gameTimeLimit;

if(!start) return;

// Evitar timers duplicados (playAgain / doble start)
if(gameTimer){
  clearInterval(gameTimer);
  gameTimer = null;
}

gameTimer = setInterval(()=>{

if(gameEnded){
  clearInterval(gameTimer);
  gameTimer = null;
  return;
}

let now = Date.now();
let secondsPassed = Math.floor((now - start)/1000);
let remaining = limit - secondsPassed;

if(remaining < 0) remaining = 0;

let timerEl = document.getElementById("gameTimerDisplay");
if(timerEl) timerEl.innerText = remaining;

if(remaining <= 0){
clearInterval(gameTimer);
gameTimer = null;
endGameByTime();
}

},1000);

});
}

function endGameByTime(){

if(gameEnded) return;
gameEnded = true;

gamePaused = true;
    
// cerrar quiz si estaba abierto
let quizBox = document.getElementById("quiz");
if(quizBox){
quizBox.classList.add("hidden");
}
    
clearInterval(gameLoop);
clearInterval(gameTimer);
clearInterval(quizTimer);
    
gameStarted = false;

stopMusic();

// 🔊 sonido GAME OVER cuando el tiempo termina
setTimeout(()=>{

playSound("gameover");

},200);
    
let gameOverDiv = document.getElementById("gameOver");

gameOverDiv.innerHTML = "<h1 class='timeOver'>TIME OVER</h1>";

gameOverDiv.classList.remove("hidden");

// mostrar ranking después de 5 segundos

setTimeout(()=>{

playSound("victory");
   
document.getElementById("gameOver").classList.add("hidden");

document.getElementById("container").style.display="none";

document.getElementById("finalRoom").style.display="block";

// 🎉 confetti solo en PC
if(window.innerWidth > 600){
startPixelConfetti();
}

showFinalRanking();


},5000);
}

function gameOver(){

if(gameEnded) return;   // 🔴 evita que vuelva a ejecutarse
gameEnded = true;       // 🔴 marca que el juego terminó
gamePaused = true;
gameStarted = false;

stopMusic();

playSound("gameover");

// 🔥 Detener TODOS los timers (antes solo se paraba gameLoop)
if(gameLoop){ clearInterval(gameLoop); gameLoop = null; }
if(gameTimer){ clearInterval(gameTimer); gameTimer = null; }
if(quizTimer){ clearInterval(quizTimer); quizTimer = null; }

// cerrar quiz si estaba abierto
let quizBox = document.getElementById("quiz");
if(quizBox) quizBox.classList.add("hidden");
currentQuizData = null;

// 🔥 guardar primer intento
if(firstTryScore === null){
   firstTryScore = score;
   updateTryTables();
}else{
   secondTryScore = score;
   updateTryTables();
}
    
document.getElementById("gameOver")
.classList.remove("hidden");

// 🔊 victoria después de un momento
setTimeout(()=>{
if(!gameEnded) return; // por si playAgain ya corrió
playSound("victory");
},2000);

}

function rotatePiece(){

let rotated = piece.shape[0].map((_,i)=>

piece.shape.map(row=>row[i]).reverse()

);

let oldShape = piece.shape;

piece.shape = rotated;


// evita atravesar paredes

if(collide()){

piece.shape = oldShape;

// intentar mover a la derecha
piece.x++;

if(collide()){
piece.x -= 2;

if(collide()){
piece.x++;
piece.shape = oldShape;
}

}

}

}

// -------- RANKING FIREBASE --------

// Registrar / re-registrar al jugador en la sala (evita que desaparezca si el teacher abre la sala después)
function registerPlayer(){
  if(!playerName || !roomCode || !playerId) return;

  let playerRef = firebase.database()
  .ref("rooms/"+roomCode+"/players/"+playerId);

  playerRef.set({
     id: playerId,
     name: playerName,
     score: score || 0
  });

  // 🔥 Si el jugador cierra la pestaña / se desconecta → borrar de la tabla
  // (evita jugadores "fantasma")
  playerRef.onDisconnect().remove();

  // También limpiar su gameState al salir
  firebase.database()
  .ref("rooms/"+roomCode+"/gameStates/"+playerId)
  .onDisconnect()
  .remove();
}

function updateRanking(){

if(!playerName || !roomCode) return;

players[playerId]={
id: playerId,
name: playerName,
score: score
};

drawRanking();

// 🔥 Guardar en Firebase
firebase.database()
.ref("rooms/"+roomCode+"/players/"+playerId)
.set({
   id: playerId,
   name: playerName,
   score: score
});

}

function sendGameState(){

if(!roomCode || !playerName) return;

// 🎯 SOLO el seleccionado manda TODO
if(playerId === selectedPlayer && currentQuizData !== undefined){

firebase.database()
.ref("rooms/"+roomCode+"/gameStates/"+playerId)
.set({
board: board,
score: score,
piece: piece,
quiz: currentQuizData
});

}else{

// 💤 solo score (ligero)
firebase.database()
.ref("rooms/"+roomCode+"/gameStates/"+playerId)
.set({
score: score
});

}

}

let players={};

let currentQuizData = null;

let questionOrder = [];
let currentQuestionIndex = 0;

function drawRanking(){

   let list = document.getElementById("playersList");
   if(!list) return;

   list.innerHTML = "";

   Object.values(players)
   .sort((a,b)=> b.score - a.score)
   .forEach((player,index)=>{

      let li = document.createElement("li");
li.className = "player";

if(player.id === playerId){
   li.classList.add("currentPlayer");
}

      li.innerHTML =
         "<span>"+(index+1)+". "+player.name+"</span>" +
         "<span>"+player.score+"</span>";

      list.appendChild(li);

   });

}

function saveTryScore(){

if(currentTry === 1){

firstTryScore = score;
document.getElementById("firstTryScore").innerText = firstTryScore;

currentTry = 2;

}else{

secondTryScore = score;
document.getElementById("secondTryScore").innerText = secondTryScore;

}

}

function updateTryTables(){

let firstTable = document.getElementById("firstTryScore");
let secondTable = document.getElementById("secondTryScore");

if(firstTable){
   firstTable.innerText = firstTryScore ?? "-";
}

if(secondTable){
   secondTable.innerText = secondTryScore ?? "-";
}

}

// -------- REALTIME RANKING --------

function activateRealtimeRanking(){

   if(!roomCode || roomCode === "") return;

   // Ranking de jugadores en tiempo real
   firebase.database()
   .ref("rooms/"+roomCode+"/players")
   .on("value", function(snapshot){

      players = snapshot.val() || {};
      drawRanking();

   });

   // First try (listener separado, solo una vez)
   firebase.database()
   .ref("rooms/"+roomCode+"/firstTry")
   .on("value", snapshot => {

      const data = snapshot.val();

      if(!data) return;

      let html = "";

      Object.values(data)
      .sort((a,b)=> b.score-a.score)
      .forEach(player => {
         html += player.name + " — " + player.score + "<br>";
      });

      let el = document.getElementById("firstTryScore");
      if(el) el.innerHTML = html;

   });

}

function playAgain(){

saveTryScore();

// 🔥 RESET DE ESTADO GLOBAL
gameEnded = false;
gamePaused = false;
gameStarted = true;

// 🔥 LIMPIAR QUIZ ACTUAL (muy importante)
currentQuizData = null;

// 🔥 RESETEAR SCORE
score = 0;
scoreText.innerText = score;

// 🔥 RESETEAR SCORE EN FIREBASE (tu código intacto)
firebase.database()
.ref("rooms/"+roomCode+"/players/"+playerId)
.set({
   id: playerId,
   name: playerName,
   score: 0
});

// 🔥 GUARDAR FIRST TRY (tu código intacto)
firebase.database()
.ref("rooms/"+roomCode+"/firstTry/"+playerName)
.once("value", function(snapshot){

   if(!snapshot.exists()){

      firebase.database()
      .ref("rooms/"+roomCode+"/firstTry/"+playerName)
      .set({
         name: playerName,
         score: firstTryScore
      });

   }

});

// 🔥 RESETEAR TABLERO Y PIEZA (tu código intacto)
board = Array.from({length:ROWS},()=>Array(COLS).fill(0));
piece = randomPiece();

// 🔥 RESETEAR SISTEMA DE QUIZ (FALTABA)
pieceCounter = 0;
currentQuestionIndex = 0;

// 🔥 RESETEAR VELOCIDAD (tu código + mejora)
fallSpeed = 700;
speedIncreaseCount = 0;
lastSpeedChange = 0;

// 🔥 LIMPIAR TODOS LOS TIMERS (CRÍTICO)
clearInterval(gameLoop);
clearInterval(gameTimer);
clearInterval(quizTimer);

// 🔥 OCULTAR GAME OVER (tu código intacto)
document.getElementById("gameOver").classList.add("hidden");

// 🔥 REINICIAR SISTEMAS QUE FALTABAN
playMusicLoop();     // 🎵 música vuelve
startGameLoop();     // 🎮 loop normal
startGameTimer();    // ⏱ tiempo vuelve

}

// ---------------------------
// FINAL RANKING
// ---------------------------

function showFinalRanking(){

firebase.database()
.ref("rooms/"+roomCode)
.once("value", snapshot => {

let data = snapshot.val();

if(!data) return;

let finalPlayers = [];

// jugadores normales
if(data.players){

Object.values(data.players).forEach(p=>{

finalPlayers.push({
name:p.name,
score:p.score
});

});

}

// jugadores firstTry
if(data.firstTry){

Object.values(data.firstTry).forEach(p=>{

let exists = finalPlayers.find(pl=>pl.name===p.name);

if(!exists){

finalPlayers.push({
name:p.name,
score:p.score
});

}else{

// ⭐ si existe comparar score y guardar el mayor
if(p.score > exists.score){
exists.score = p.score;
}

}

});

}

finalPlayers.sort((a,b)=>b.score-a.score);

drawFinalRanking(finalPlayers);

});

}

function drawFinalRanking(list){

let container = document.getElementById("finalRanking");

container.innerHTML = `
<table class="finalTable">
<tr>
<th>Rank</th>
<th>Player</th>
<th>Score</th>
</tr>
<tbody id="rankingBody"></tbody>
</table>
`;

let body = document.getElementById("rankingBody");

list.sort((a,b)=>b.score-a.score);

list.forEach((p,i)=>{

setTimeout(()=>{

let medal = i+1;

if(i===0) medal="🥇";
else if(i===1) medal="🥈";
else if(i===2) medal="🥉";

let row = document.createElement("tr");

row.className="rankingRow place"+(i+1);

row.innerHTML=`
<td>${medal}</td>
<td>${p.name}</td>
<td>${p.score}</td>
`;

body.appendChild(row);

}, i*1000);

});

}

function startGame(){

if(gameStarted) return;

startScreen.style.display="none";

gameStarted = true;

// 🔥 RESET REAL DE VELOCIDAD
fallSpeed = 700;
speedIncreaseCount = 0;
lastSpeedChange = 0;

playMusicLoop();

startGameLoop();

startGameTimer();

}

function goToFinalRanking(){

if(!roomCode){
alert("Open a room first");
return;
}

window.open("index.html?final="+roomCode, "_blank");

}

function waitForTeacher(){

// 👇 🔥 ESCUCHAR jugador seleccionado
firebase.database()
.ref("rooms/"+roomCode+"/selectedPlayer")
.on("value", snap => {

selectedPlayer = snap.val();

});

// 🔥 NUEVO: ORDEN DE PREGUNTAS
firebase.database()
.ref("rooms/"+roomCode+"/questionOrder")
.on("value", snap => {

let data = snap.val();

if(data){
   questionOrder = data;
}

});

// 🔥 NUEVO: INDICE ACTUAL
firebase.database()
.ref("rooms/"+roomCode+"/questionIndex")
.on("value", snap => {

let data = snap.val();

if(data !== null){
   currentQuestionIndex = data;
}

});

// 👇 Escuchar estado de la sala
firebase.database()
.ref("rooms/"+roomCode+"/status")
.on("value", function(snapshot){

let status = snapshot.val();

// Si la sala vuelve a "waiting" (teacher reabrió), re-registrarse
// para no desaparecer de la tabla de players
if(status === "waiting"){
  registerPlayer();
}

if(status === "playing"){
startGame();
}

});

}

function startPixelConfetti(){

let canvas = document.getElementById("confettiCanvas");

if(!canvas) return; // evita error si no existe

let ctx = canvas.getContext("2d");


// 🔧 Ajuste seguro para móvil y PC
function resizeConfettiCanvas(){

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

}

// ajustar al iniciar
resizeConfettiCanvas();

// ajustar si se rota el celular o cambia tamaño
window.addEventListener("resize", resizeConfettiCanvas);


let pixels = [];

for(let i=0;i<150;i++){

pixels.push({

x:Math.random()*canvas.width,
y:Math.random()*canvas.height,

size:6,

speed:1+Math.random()*3,

color:["#00ffff","#ff00ff","#ffff00","#00ff00","#ff3333"][Math.floor(Math.random()*5)]

});

}

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

pixels.forEach(p=>{

ctx.fillStyle=p.color;

ctx.fillRect(p.x,p.y,p.size,p.size);

p.y+=p.speed;

if(p.y>canvas.height){

p.y=0;
p.x=Math.random()*canvas.width;

}

});

requestAnimationFrame(draw);

}

draw();

setTimeout(()=>{

let c = document.getElementById("confettiCanvas");
if(c) c.style.display="none";

},5000);

}

function updateStats(){

let correctBox = document.getElementById("correctAnswers");
let rowsBox = document.getElementById("cleanRows");

if(correctBox){
correctBox.innerText = correctAnswers;
}

if(rowsBox){
rowsBox.innerText = cleanRows;
}

}

document.addEventListener("keydown",e=>{

// No mover si no ha empezado, está en quiz, o terminó
if(!gameStarted || gamePaused || gameEnded) return;

// evitar scroll con flechas/espacio
if(["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space"].includes(e.code)){
  e.preventDefault();
}

// IZQUIERDA
if(e.key==="ArrowLeft"){
piece.x--;
if(collide()) piece.x++;
}

// DERECHA
if(e.key==="ArrowRight"){
piece.x++;
if(collide()) piece.x--;
}

// ABAJO
if(e.key==="ArrowDown"){
piece.y++;
if(collide()){
piece.y--;
merge(); // fija pieza
}
}

// ⭐ ROTAR con espacio
if(e.code==="Space"){
rotatePiece();
}

});

function bindBtn(btn, fn){

   let touched = false;

   btn.addEventListener("touchstart", (e)=>{
      touched = true;
      e.preventDefault();
      fn();
   }, {passive: false});

   btn.addEventListener("touchend", (e)=>{
      e.preventDefault();
      // reset after un momento para permitir click en PC
      setTimeout(()=>{ touched = false; }, 400);
   }, {passive: false});

   btn.addEventListener("click", (e)=>{
      if(touched){
        e.preventDefault();
        return;
      }
      fn();
   });

}

// CONTROLES MOVIL (touch + click, respetan pausa/fin)

function canControl(){
  return gameStarted && !gamePaused && !gameEnded;
}

window.addEventListener("load", ()=>{

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const rotateBtn = document.getElementById("rotateBtn");

if(leftBtn){
bindBtn(leftBtn, ()=>{
if(!canControl()) return;
piece.x--;
if(collide()) piece.x++;
drawBoard(); drawPiece();
});
}

if(rightBtn){
bindBtn(rightBtn, ()=>{
if(!canControl()) return;
piece.x++;
if(collide()) piece.x--;
drawBoard(); drawPiece();
});
}

if(downBtn){
bindBtn(downBtn, ()=>{
if(!canControl()) return;
piece.y++;
if(collide()){
piece.y--;
merge();
}
drawBoard(); drawPiece();
});
}

if(rotateBtn){
bindBtn(rotateBtn, ()=>{
if(!canControl()) return;
rotatePiece();
drawBoard(); drawPiece();
});
}

});

function watchPlayer(playerId){

firebase.database()
.ref("rooms/"+roomCode)
.update({
selectedPlayer: playerId
});

}

