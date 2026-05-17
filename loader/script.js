(function () {
  class NeonCubeLoader {
    constructor(target, options = {}) {
      this.container =
        typeof target === "string" ? document.querySelector(target) : target;
      const durationAttribute = Number(
        this.container ? this.container.dataset.duration : 0,
      );
      const duration = Number(options.duration || durationAttribute || 3);
      const nextPage =
        options.nextPage ||
        (this.container ? this.container.dataset.nextPage : "");
      this.options = {
        cubeSize: options.cubeSize || 62,
        color: options.color || 0xffffff,
        glowColor: options.glowColor || 0x00d8ff,
        backgroundColor: options.backgroundColor || 0x000000,
        duration: Math.max(1, duration),
        transitionDuration: options.transitionDuration || 1.15,
        nextPage: nextPage || "",
      };

      if (!this.container) {
        throw new Error("NeonCubeLoader target element was not found.");
      }

      this.scene = new THREE.Scene();
      this.clock = new THREE.Clock();
      this.animationFrame = null;
      this.resizeObserver = null;
      this.progressBar = this.container.querySelector(
        ".loader-progress-track span",
      );
      this.progressValue = this.container.querySelector(
        ".loader-progress-value",
      );
      this.beamTransition = this.container.querySelector(
        ".loader-beam-transition",
      );
      this.beamVertical = this.beamTransition
        ? this.beamTransition.querySelector(".beam-vertical")
        : null;
      this.beamHorizontal = this.beamTransition
        ? this.beamTransition.querySelector(".beam-horizontal")
        : null;
      this.flash = this.beamTransition
        ? this.beamTransition.querySelector(".flash")
        : null;
      this.progressState = { value: 0 };
      this.isTransitioning = false;
    }

    init() {
      this.createCamera();
      this.createRenderer();
      this.createLights();
      this.createCube();
      this.createReflection();
      this.animateCube();
      this.bindPointer();
      this.observeResize();
      this.render();
      this.restart();
      return this;
    }

    createCamera() {
      const { width, height } = this.getSize();
      const zoom = this.getResponsiveZoom(width);

      this.camera = new THREE.OrthographicCamera(
        width / -zoom,
        width / zoom,
        height / zoom,
        height / -zoom,
        1,
        1600,
      );
      this.camera.position.set(420, 420, 420);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();
    }

    createRenderer() {
      const { width, height } = this.getSize();

      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      this.renderer.setClearColor(this.options.backgroundColor, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.container.appendChild(this.renderer.domElement);
    }

    createLights() {
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(80, 160, 120);
      keyLight.castShadow = true;
      this.scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(this.options.glowColor, 1.4);
      rimLight.position.set(-140, 120, -80);
      this.scene.add(rimLight);

      const fillLight = new THREE.AmbientLight(0x5fe9ff, 0.45);
      this.scene.add(fillLight);
    }

    createCube() {
      this.cubeGroup = new THREE.Group();
      this.cubeGroup.position.y = 32;
      this.scene.add(this.cubeGroup);

      const geometry = new THREE.BoxGeometry(
        this.options.cubeSize,
        this.options.cubeSize,
        this.options.cubeSize,
      );

      const material = new THREE.MeshLambertMaterial({
        color: this.options.color,
        emissive: this.options.glowColor,
        emissiveIntensity: 0.14,
        flatShading: true,
      });

      this.cube = new THREE.Mesh(geometry, material);
      this.cube.castShadow = true;
      this.cubeGroup.add(this.cube);

      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: this.options.glowColor,
        transparent: true,
        opacity: 0.86,
      });

      this.edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      this.cubeGroup.add(this.edges);
    }

    createReflection() {
      this.reflectionGroup = this.cubeGroup.clone(true);
      this.reflectionGroup.position.y = -96;
      this.reflectionGroup.scale.y = -0.46;
      this.reflectionGroup.scale.x = 1.08;
      this.reflectionGroup.scale.z = 1.08;

      this.reflectionGroup.traverse((child) => {
        if (!child.material) {
          return;
        }

        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = child.isLineSegments ? 0.16 : 0.2;
        child.material.depthWrite = false;
      });

      this.scene.add(this.reflectionGroup);
    }

    animateCube() {
      if (window.gsap) {
        const unit = this.options.duration / 4.5;
        this.timeline = gsap.timeline({ paused: true });
        this.timeline
          .to(this.cubeGroup.scale, {
            duration: unit * 0.72,
            x: 1.86,
            ease: "expo.out",
          })
          .to(this.cubeGroup.scale, {
            duration: unit * 0.72,
            z: 1.86,
            ease: "expo.out",
          })
          .to(this.cubeGroup.scale, {
            duration: unit * 1.1,
            y: 1.76,
            ease: "elastic.out(1, 0.48)",
          })
          .to(this.cubeGroup.scale, {
            duration: unit * 0.92,
            x: 1,
            y: 1,
            z: 1,
            ease: "expo.out",
          })
          .to(
            this.cubeGroup.rotation,
            { duration: unit * 1.04, y: "-=3.14159", ease: "expo.out" },
            `-=${unit * 0.92}`,
          );
        this.timeline.duration(this.options.duration);
      }
    }

    bindPointer() {
      this.container.addEventListener("click", () => this.restart());
      this.container.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.restart();
        }
      });

      if (!this.container.hasAttribute("tabindex")) {
        this.container.setAttribute("tabindex", "0");
      }
    }

    restart() {
      if (this.isTransitioning) {
        return;
      }

      this.container.classList.remove("is-loaded");

      if (this.timeline) {
        this.timeline.restart(true);
      }

      if (this.progressTween) {
        this.progressTween.kill();
      }

      if (this.percentTween) {
        this.percentTween.kill();
      }

      if (this.progressBar && window.gsap) {
        this.progressState.value = 0;
        this.updateProgressText(0);
        gsap.set(this.progressBar, { scaleX: 0 });
        this.progressTween = gsap.to(this.progressBar, {
          duration: this.options.duration,
          scaleX: 1,
          ease: "none",
          onComplete: () => this.finishLoading(),
        });
        this.percentTween = gsap.to(this.progressState, {
          duration: this.options.duration,
          value: 100,
          ease: "none",
          onUpdate: () => this.updateProgressText(this.progressState.value),
          onComplete: () => this.updateProgressText(100),
        });
      }
    }

    finishLoading() {
      this.container.classList.add("is-loaded");
      this.updateProgressText(100);
      this.playExitTransition();
    }

    playExitTransition() {
      if (!window.gsap || this.isTransitioning) {
        this.goToNextPage();
        return;
      }

      this.isTransitioning = true;
      this.container.classList.add("is-transitioning");

      if (this.timeline) {
        this.timeline.pause();
      }

      const reflectionMaterials = this.getObjectMaterials(this.reflectionGroup);
      const glowingMaterials = this.getObjectMaterials(this.cubeGroup).filter(
        (material) => "emissiveIntensity" in material,
      );

      gsap
        .timeline({
          defaults: { ease: "power2.inOut" },
          onComplete: () => this.goToNextPage(),
        })
        .to(
          reflectionMaterials,
          {
            duration: 0.24,
            opacity: 0,
          },
          0,
        )
        .to(
          this.reflectionGroup.scale,
          {
            duration: 0.24,
            x: 0.2,
            y: -0.08,
            z: 0.2,
          },
          0,
        )
        .to(
          glowingMaterials,
          {
            duration: 0.22,
            emissiveIntensity: 2.0,
          },
          0,
        )
        .to(
          this.cubeGroup.scale,
          {
            duration: 0.4,
            x: 0,
            y: 0,
            z: 0,
            ease: "back.in(2)",
          },
          0.1,
        )
        .to(
          this.beamVertical,
          {
            duration: 0.3,
            height: "100vh",
            opacity: 1,
            ease: "power4.out",
          },
          0.4,
        )
        .to(
          this.beamVertical,
          {
            duration: 0.2,
            width: "100vw",
            ease: "power2.inOut",
          },
          0.7,
        )
        .to(
          this.beamHorizontal,
          {
            duration: 0.4,
            height: "100vh",
            opacity: 1,
            ease: "power4.inOut",
          },
          0.8,
        )
        .to(
          this.flash,
          {
            duration: 0.3,
            opacity: 1,
            ease: "none",
          },
          1.0,
        )
        .to(
          this.renderer.domElement,
          {
            duration: 0.2,
            opacity: 0,
          },
          1.0,
        );
    }

    goToNextPage() {
      if (this.options.nextPage) {
        window.location.href = this.options.nextPage;
      }
    }

    getObjectMaterials(object) {
      const materials = [];

      object.traverse((child) => {
        if (Array.isArray(child.material)) {
          materials.push(...child.material);
        } else if (child.material) {
          materials.push(child.material);
        }
      });

      return materials;
    }

    updateProgressText(value) {
      if (this.progressValue) {
        this.progressValue.textContent = `${Math.round(value)}%`;
      }

      this.container.setAttribute(
        "aria-label",
        `Loading ${Math.round(value)} percent`,
      );
    }

    observeResize() {
      const resize = () => this.resize();

      if ("ResizeObserver" in window) {
        this.resizeObserver = new ResizeObserver(resize);
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener("resize", resize);
      }

      window.addEventListener("orientationchange", resize);
    }

    resize() {
      const { width, height } = this.getSize();
      const zoom = this.getResponsiveZoom(width);

      this.camera.left = width / -zoom;
      this.camera.right = width / zoom;
      this.camera.top = height / zoom;
      this.camera.bottom = height / -zoom;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    getSize() {
      const bounds = this.container.getBoundingClientRect();
      return {
        width: Math.max(320, Math.floor(bounds.width || window.innerWidth)),
        height: Math.max(320, Math.floor(bounds.height || window.innerHeight)),
      };
    }

    getResponsiveZoom(width) {
      if (width < 480) {
        return 2.15;
      }

      if (width < 800) {
        return 2.45;
      }

      return 3;
    }

    syncReflection() {
      this.reflectionGroup.rotation.copy(this.cubeGroup.rotation);
      this.reflectionGroup.scale.x = this.cubeGroup.scale.x * 1.08;
      this.reflectionGroup.scale.y = this.cubeGroup.scale.y * -0.46;
      this.reflectionGroup.scale.z = this.cubeGroup.scale.z * 1.08;
      this.reflectionGroup.position.y =
        -92 - Math.abs(Math.sin(this.clock.elapsedTime * 1.6)) * 8;
    }

    render() {
      this.animationFrame = requestAnimationFrame(() => this.render());
      const elapsed = this.clock.getElapsedTime();

      this.cubeGroup.rotation.x = Math.sin(elapsed * 0.6) * 0.08;
      this.cubeGroup.rotation.z = Math.cos(elapsed * 0.42) * 0.06;
      this.syncReflection();
      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      cancelAnimationFrame(this.animationFrame);

      if (this.timeline) {
        this.timeline.kill();
      }

      if (this.progressTween) {
        this.progressTween.kill();
      }

      if (this.percentTween) {
        this.percentTween.kill();
      }

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      this.renderer.dispose();
      this.container.innerHTML = "";
    }
  }

  window.NeonCubeLoader = NeonCubeLoader;

  window.addEventListener("DOMContentLoaded", () => {
    const loaderElement = document.querySelector("#neon-cube-loader");

    if (loaderElement && window.THREE) {
      new NeonCubeLoader(loaderElement).init();
    }
  });
})();
