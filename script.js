/* global Papa, THREE */

const CITY = 0;
const REPORTING_YEAR = 1;
const EMISSIONS = 2;
const PER_CAPITA = 3;
const POPULATION = 4;
const YEAR_REPORTED = 5;
const METHOD = 6;
let dx = 0;
let dz = 0;
let theta = Math.PI / 2;
let phi = Math.PI / 2;
let buildingMap = new Map();

let raycaster = new THREE.Raycaster();
const scene = new THREE.Scene();
let continueAnimation = true;
let year = 2015;
let yearMap;
let maxHeight = 60;
let maxEmissions = 60;

let camera;
let texture;
let renderer;

async function handleLoad() {
  let res = await fetch("data.csv");
  let text = await res.text();
  let dirtyData = Papa.parse(text).data;
  let metadata = dirtyData.shift();
  let data = filter(preprocess(dirtyData));
  maxEmissions = Math.max(...data.map((row) => row[EMISSIONS]));
  yearMap = splitByYears(data);
  setupScene();
  updateSceneYear(yearMap.get(year));
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  document.addEventListener("mousedown", handleMouseDown);
}

function filter(data) {
  return data.filter(
    ([
      name,
      reportingPeriod,
      emissions,
      perCapita,
      population,
      yearReported,
      method
    ]) =>
      !(
        isNaN(reportingPeriod) ||
        isNaN(emissions) ||
        isNaN(perCapita) ||
        isNaN(population) ||
        isNaN(yearReported)
      )
  );
}

function preprocess(data) {
  return data.map(
    ([
      name,
      reportingPeriod,
      emissions,
      perCapita,
      population,
      yearReported,
      method
    ]) => [
      name,
      parseInt(reportingPeriod, 10),
      parseInt(emissions.split(",").join(""), 10),
      parseFloat(perCapita),
      parseInt(population.split(",").join(""), 10),
      parseInt(yearReported, 10),
      method
    ]
  );
}

function splitByYears(data) {
  let yearMap = new Map();
  data.forEach((row) => {
    // is the year not already in the map?
    let year = row[REPORTING_YEAR];
    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    yearMap.get(year).push(row);
  });
  return yearMap;
}

function infSquare(x) {
  return Math.ceil(Math.sqrt(x));
}

function postProcessNumber(x) {
  x = x.toString();
  let res = "";
  for (let i = x.length - 1; i >= 0; i--) {
    res = x.charAt(i) + res;
    if ((x.length - i - 1) % 3 === 2 && i > 0) {
      res = " " + res;
    }
  }
  return res;
}

function setupScene() {
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setClearColor(0xffffff, 0);

  let URL = "textures/grass.jpg";
  texture = new THREE.TextureLoader().load(URL);

  // set the size of the renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  let animate = function () {
    let v = new THREE.Vector3();
    camera.getWorldDirection(v);
    camera.position.x += (v.x * dz) / 100;
    camera.position.z += (v.z * dz) / 100;
    camera.position.x += (-v.z * dx) / 100;
    camera.position.z += (v.x * dx) / 100;

    camera.lookAt(
      camera.position.x + Math.sin(theta) * Math.cos(phi),
      camera.position.y + Math.cos(theta),
      camera.position.z + Math.sin(theta) * Math.sin(phi)
    );

    camera.getWorldDirection(v);
    let u = new THREE.Vector3();
    camera.getWorldPosition(u);
    raycaster.set(u, v);
    let intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length >= 1 && buildingMap.has(intersects[0].object)) {
      let row = buildingMap.get(intersects[0].object);
      document.getElementById("info").hidden = false;
      document.getElementById("city").innerHTML = `<b>${row[CITY]}</b>`;
      document.getElementById(
        "co2-emissions"
      ).innerHTML = `CO<sub>2</sub> emissions: ${postProcessNumber(
        row[EMISSIONS]
      )} Metric Tonnes.`;
      document.getElementById(
        "co2-per-capita"
      ).innerHTML = `CO<sub>2</sub> per capita: ${row[PER_CAPITA]} Metric Tonnes per person.`;
      document.getElementById(
        "population"
      ).textContent = `Population: ${postProcessNumber(
        row[POPULATION]
      )} residents.`;
    } else {
      document.getElementById("info").hidden = true;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
}

function updateSceneYear(data) {
  theta = Math.PI / 2;
  phi = 0;
  // set the background
  scene.background = new THREE.Color(0x98bfde);

  // load the texture

  // initialize the floor
  let materialFloor;

  // URL for the picture representing the floor

  // repeat the texture
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  let timesToRepeatHorizontally = 500;
  let timesToRepeatVertically = 500;
  texture.repeat.set(timesToRepeatHorizontally, timesToRepeatVertically);

  materialFloor = new THREE.MeshBasicMaterial({
    map: texture
  });

  // scene.background = new THREE.Color(0x99ccff);

  // make a light source
  let light1 = new THREE.PointLight(0xffffff, 1, 100);
  let light2 = new THREE.PointLight(0xffffff, 1, 100);
  let light3 = new THREE.PointLight(0xffffff, 1, 100);

  let side = infSquare(data.length);
  light1.position.set(-3 * side, 3 * side, -3 * side);
  light2.position.set(-3 * side, 3 * side, 0);
  light3.position.set(-3 * side, 3 * side, 3 * side);
  // make a floor
  let geometryFloor = new THREE.BoxGeometry(100, 10, 100);

  // let materialFloor = new THREE.MeshLambertMaterial({
  //   color: 0x4d4d4d,
  //   emissive: 0x477a1e // for the colour of the ground
  // });

  let floor = new THREE.Mesh(geometryFloor, materialFloor);
  floor.position.setY(-5);
  scene.add(floor);

  buildingMap = new Map();

  // make the boxes representing each city
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      let index = i * side + j;
      if (index < data.length) {
        // let co = data[index][EMISSIONS];
        let copc = data[index][PER_CAPITA];
        let height = (maxHeight * data[index][EMISSIONS]) / maxEmissions;
        let colour;
        // colour code the buildings based on the CO2/capita emissions
        if (copc < 5.0) {
          colour = 0x1034a6;
        } else if (copc < 7.5) {
          colour = 0x412f88;
        } else if (copc < 10.0) {
          colour = 0x722b6a;
        } else if (copc < 40.0) {
          colour = 0xa2264b;
        } else {
          colour = 0xff0000;
        }
        let geometry = new THREE.BoxGeometry(1, height, 1);
        let material = new THREE.MeshLambertMaterial({
          color: colour
        });
        let cube = new THREE.Mesh(geometry, material, "City");
        buildingMap.set(cube, data[index]);
        cube.position.setX((i + 0.5 - side / 2) * 2);
        cube.position.setY(height / 2);
        cube.position.setZ((j + 0.5 - side / 2) * 2);
        scene.add(cube);
      }
    }
  }
  scene.add(light1);
  scene.add(light2);
  scene.add(light3);
  camera.position.x = -2 * side;
  camera.position.z = 0;
  camera.position.y = 0.15;
  // camera.position.y = 5;
  // camera.position.x = 5;

  let t = 0;
  // renderer.render(scene, camera);
}

function clearScene() {
  while (scene.children.length) {
    scene.remove(scene.children[0]);
  }
}
// a function to implementt movement with wasd
function handleKeyDown(event) {
  if (event.code === "KeyW") {
    dz = 2;
  } else if (event.code === "KeyA") {
    dx = -2;
  } else if (event.code === "KeyS") {
    dz = -2;
  } else if (event.code === "KeyD") {
    dx = 2;
  } else if (event.code === "KeyQ") {
    if (yearMap.has(year - 1)) {
      clearScene();
      year--;
      document.getElementById("year").textContent = year;
      updateSceneYear(yearMap.get(year));
    }
  } else if (event.code === "KeyE") {
    if (yearMap.has(year + 1)) {
      clearScene();
      year++;
      document.getElementById("year").textContent = year;
      updateSceneYear(yearMap.get(year));
    }
  }
}

function handleKeyUp(event) {
  if (event.code === "KeyW") {
    dz = 0;
  } else if (event.code === "KeyA") {
    dx = 0;
  } else if (event.code === "KeyS") {
    dz = 0;
  } else if (event.code === "KeyD") {
    dx = 0;
  }
}

function handleMouseMove(event) {
  theta += event.movementY / 100;
  phi += event.movementX / 100;
  theta = Math.min(Math.PI - 0.1, theta);
  theta = Math.max(0.1, theta);
}

function handlePointerLockChange() {
  document.addEventListener("mousemove", handleMouseMove);
}

function handleMouseDown() {
  document.body.requestPointerLock =
    document.body.requestPointerLock || document.body.mozRequestPointerLock;

  document.body.requestPointerLock();

  if ("onpointerlockchange" in document) {
    document.addEventListener(
      "pointerlockchange",
      handlePointerLockChange,
      false
    );
  } else if ("onmozpointerlockchange" in document) {
    document.addEventListener(
      "mozpointerlockchange",
      handlePointerLockChange,
      false
    );
  }
}

// a function for resetting all blobs
window.addEventListener("load", handleLoad);
