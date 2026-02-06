const btn = document.getElementById("startBtn");
const path = document.getElementById("solution");


const length = path.getTotalLength();


path.style.strokeDasharray = length;
path.style.strokeDashoffset = length;

btn.addEventListener("click", () => {

  path.style.transition = "none";
  path.style.strokeDashoffset = length;
  path.getBoundingClientRect();

  path.style.transition = "stroke-dashoffset 4s linear";
  path.style.strokeDashoffset = "0";
});

