// Проверяем доступность THREE и GLTFLoader
if (typeof THREE === "undefined") {
  showError("Three.js не загружен");
}

class ARApp {
  constructor() {
    this.xrSession = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.model = null;
    this.init();
  }

  async init() {
    try {
      // Создаем Three.js сцену
      this.setupThreeJS();

      // Загружаем 3D модель
      await this.loadModel();

      document.getElementById("loading").style.display = "none";

      const button = document.getElementById("ar-button");
      button.addEventListener("click", () => this.startAR());

      // Проверка поддержки WebXR
      await this.checkXRSupport();
    } catch (error) {
      console.error("Ошибка инициализации:", error);
      showError("Ошибка инициализации: " + error.message);
    }
  }

  setupThreeJS() {
    // Создаем рендерер Three.js
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;

    document.body.appendChild(this.renderer.domElement);

    // Создаем сцену
    this.scene = new THREE.Scene();

    // Создаем камеру (будет переопределена в XR)
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );

    // Добавляем освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  async loadModel() {
    return new Promise((resolve, reject) => {
      // Проверяем доступность GLTFLoader
      if (typeof THREE.GLTFLoader === "undefined") {
        // Если GLTFLoader не доступен, создаем простую модель
        this.createSimpleModel();
        resolve();
        return;
      }

      const loader = new THREE.GLTFLoader();

      // Загружаем простую модель из интернета (можно заменить на свою)
      loader.load(
        "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf",
        (gltf) => {
          this.model = gltf.scene;

          // Масштабируем модель
          this.model.scale.set(0.5, 0.5, 0.5);

          // Прячем модель до запуска AR
          this.model.visible = false;

          this.scene.add(this.model);
          resolve();
        },
        (progress) => {
          // Прогресс загрузки
          if (progress.lengthComputable) {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(2);
            document.getElementById(
              "loading"
            ).textContent = `Загрузка модели: ${percent}%`;
          }
        },
        (error) => {
          console.error("Ошибка загрузки модели:", error);
          // Создаем простую модель в случае ошибки
          this.createSimpleModel();
          resolve();
        }
      );
    });
  }

  createSimpleModel() {
    // Создаем простую 3D модель как fallback
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
    });

    this.model = new THREE.Mesh(geometry, material);
    this.model.visible = false;

    // Добавляем анимацию вращения
    this.model.userData = { animate: true };

    this.scene.add(this.model);

    document.getElementById("loading").textContent = "Используется простая модель";
  }

  async checkXRSupport() {
    const button = document.getElementById("ar-button");

    if (!navigator.xr) {
      button.disabled = true;
      button.textContent = "WebXR не поддерживается";
      return false;
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      if (!supported) {
        button.disabled = true;
        button.textContent = "AR не поддерживается";
        return false;
      }
      return true;
    } catch (error) {
      button.disabled = true;
      button.textContent = "Ошибка проверки AR";
      return false;
    }
  }

  async startAR() {
    try {
      // Запрос AR сессии
      this.xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local"],
        optionalFeatures: ["hit-test", "dom-overlay"],
      });

      // Связываем Three.js с WebXR
      this.renderer.xr.setSession(this.xrSession);

      // Показываем модель
      if (this.model) {
        this.model.visible = true;
      }

      this.setupXR();

      // Скрываем кнопку
      document.getElementById("ar-button").style.display = "none";
    } catch (error) {
      console.error("Ошибка запуска AR:", error);
      showError("Не удалось запустить AR: " + error.message);
    }
  }

  setupXR() {
    // Создаем контроллер для взаимодействия
    const controller = this.renderer.xr.getController(0);

    controller.addEventListener("select", () => {
      this.placeModelInWorld();
    });

    this.scene.add(controller);

    // Запускаем анимацию
    this.renderer.setAnimationLoop(() => {
      this.render();
    });
  }

  placeModelInWorld() {
    if (!this.model) return;

    // Получаем позицию контроллера
    const controller = this.renderer.xr.getController(0);

    // Клонируем модель для размещения в мире
    const modelClone = this.model.clone();
    modelClone.position.copy(controller.position);
    modelClone.visible = true;

    // Если это простая модель, добавляем анимацию
    if (modelClone.userData) {
      modelClone.userData.animate = true;
    }

    this.scene.add(modelClone);
  }

  render() {
    // Анимируем модели
    this.scene.traverse((object) => {
      if (object.userData && object.userData.animate) {
        object.rotation.x += 0.01;
        object.rotation.y += 0.02;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

// Запуск приложения когда страница загружена
window.addEventListener("load", () => {
  new ARApp();
});

// Обработка изменения размера окна
window.addEventListener("resize", () => {
  if (this.renderer) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
});
