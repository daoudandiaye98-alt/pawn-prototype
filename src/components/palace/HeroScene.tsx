import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Marble chessboard + black lathed pawn.
 * Upgrades:
 *  - Soft contact shadow blob under the pawn (radial gradient sprite)
 *  - Environment reflection via lightweight gradient envMap (adds depth)
 *  - Elegant entrance animation: pawn drops in from y+3 on mount
 *  - Subtle dolly-zoom on scroll toward the finale (fov 38 → 32)
 *  - Reduced tiles + no envMap on mobile / prefers-reduced-motion
 */
export function HeroScene({ finaleProgress = 0 }: { finaleProgress?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ finale: 0, scroll: 0 });
  stateRef.current.finale = finaleProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf1eee7, 0.055);
    const initialFov = 38;
    const camera = new THREE.PerspectiveCamera(initialFov, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 2.1, 10.5);
    camera.lookAt(0, 0, 0);

    // Lights.
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(4, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf1eee7, 0.65);
    rim.position.set(-4, 3, -2);
    scene.add(rim);
    // Extra fill from below for rim on the pawn's underside.
    const fill = new THREE.DirectionalLight(0xd9d5cc, 0.25);
    fill.position.set(0, -4, 3);
    scene.add(fill);

    // Gradient envMap — cheap reflection giving pieces subtle depth.
    let envMap: THREE.Texture | null = null;
    if (!isMobile) {
      const canv = document.createElement("canvas");
      canv.width = 256; canv.height = 256;
      const ctx = canv.getContext("2d");
      if (ctx) {
        const grd = ctx.createLinearGradient(0, 0, 0, 256);
        grd.addColorStop(0, "#f6f3ec");
        grd.addColorStop(0.5, "#8a8780");
        grd.addColorStop(1, "#0d0d0f");
        ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
        envMap = new THREE.CanvasTexture(canv);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
      }
    }

    // Chessboard tiles.
    const boardGroup = new THREE.Group();
    boardGroup.position.y = -2.2;
    const N = isMobile ? 13 : 21;
    const size = 0.62;
    const tileGeom = new THREE.BoxGeometry(size, 0.06, size);
    const matLight = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.9 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.85 });
    const tiles: { mesh: THREE.Mesh; base: number; dist: number }[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const dark = (i + j) % 2 === 0;
        const m = new THREE.Mesh(tileGeom, dark ? matDark : matLight);
        const x = (i - (N - 1) / 2) * size;
        const z = (j - (N - 1) / 2) * size;
        m.position.set(x, 0, z);
        boardGroup.add(m);
        tiles.push({ mesh: m, base: 0, dist: Math.sqrt(x * x + z * z) });
      }
    }
    scene.add(boardGroup);

    // Soft contact shadow — a radial gradient plane just above the board.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256; shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext("2d");
    if (sctx) {
      const rad = sctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      rad.addColorStop(0, "rgba(0,0,0,0.55)");
      rad.addColorStop(0.5, "rgba(0,0,0,0.18)");
      rad.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = rad; sctx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.15;
    scene.add(shadowMesh);

    // Pawn silhouette (lathe).
    const pawnProfile = [
      [0, -1.5], [0.78, -1.5], [0.82, -1.34], [0.5, -1.2],
      [0.42, -0.6], [0.3, -0.1], [0.26, 0.3],
      [0.42, 0.44], [0.42, 0.56], [0.24, 0.66], [0, 0.66],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pawnGeom = new THREE.LatheGeometry(pawnProfile, 64);
    const pieceMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c0e, roughness: 0.32, metalness: 0.15,
      envMap, envMapIntensity: 0.55,
    });
    const pawnMesh = new THREE.Mesh(pawnGeom, pieceMat);
    const pawnHead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), pieceMat);
    pawnHead.position.y = 1;
    const pawnGroup = new THREE.Group();
    pawnGroup.add(pawnMesh, pawnHead);
    // Entrance animation start position (skipped if reduced motion).
    if (!reducedMotion) pawnGroup.position.y = 3.5;
    scene.add(pawnGroup);

    // Queen (finale morph).
    const queenProfile = [
      [0, -1.5], [0.86, -1.5], [0.9, -1.32], [0.55, -1.16],
      [0.44, -0.5], [0.3, 0.1], [0.26, 0.62],
      [0.5, 0.8], [0.5, 0.92], [0.3, 1.02], [0.34, 1.28], [0.16, 1.36], [0, 1.36],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const queenGeom = new THREE.LatheGeometry(queenProfile, 64);
    const queenMesh = new THREE.Mesh(queenGeom, pieceMat);
    const queenOrb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), pieceMat);
    queenOrb.position.y = 1.55;
    const crownGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 12), pieceMat);
      const a = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.34, 1.55, Math.sin(a) * 0.34);
      crownGroup.add(spike);
    }
    const queenGroup = new THREE.Group();
    queenGroup.add(queenMesh, queenOrb, crownGroup);
    queenGroup.scale.setScalar(0);
    scene.add(queenGroup);

    // Interaction.
    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!isMobile) window.addEventListener("mousemove", onMove);

    const onResize = () => {
      if (!container) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const onScroll = () => { stateRef.current.scroll = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const clock = new THREE.Clock();
    const startAt = performance.now();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      const elapsed = (performance.now() - startAt) / 1000;

      // Board breathing.
      for (const { mesh, dist } of tiles) {
        mesh.position.y = Math.sin(t * 0.85 - dist * 0.5) * 0.04;
      }

      // Entrance animation: ease pawn down over ~1.2s.
      if (!reducedMotion && elapsed < 1.4) {
        const p = Math.min(1, elapsed / 1.2);
        const eased = 1 - Math.pow(1 - p, 3);
        pawnGroup.position.y = 3.5 * (1 - eased);
        // Shadow tightens as the pawn lands.
        shadowMesh.scale.setScalar(0.6 + 0.4 * eased);
        shadowMat.opacity = 0.2 + 0.8 * eased;
      } else {
        pawnGroup.position.y = Math.sin(t * 1.1) * 0.02; // gentle float
        shadowMesh.scale.setScalar(1);
        shadowMat.opacity = 1;
      }

      // Rotations.
      pawnGroup.rotation.y = t * 0.2;
      queenGroup.rotation.y = t * 0.2 + stateRef.current.finale * Math.PI * 3;

      // Morph.
      const f = stateRef.current.finale;
      pawnGroup.scale.setScalar(Math.max(0, 1 - f));
      (pawnMesh.material as THREE.MeshStandardMaterial).opacity = 1 - f;
      (pawnMesh.material as THREE.MeshStandardMaterial).transparent = true;
      queenGroup.scale.setScalar(f);

      // Camera parallax + dolly-zoom (fov shrinks as finale approaches).
      const targetFov = initialFov - f * 6;
      camera.fov += (targetFov - camera.fov) * 0.06;
      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (2.1 + mouse.y * 0.3 - camera.position.y) * 0.03;
      // Push in slightly toward finale.
      const targetZ = 10.5 - f * 1.5;
      camera.position.z += (targetZ - camera.position.z) * 0.03;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0.2, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      renderer.dispose();
      tileGeom.dispose();
      matLight.dispose();
      matDark.dispose();
      pawnGeom.dispose();
      queenGeom.dispose();
      pieceMat.dispose();
      shadowTex.dispose();
      shadowMat.dispose();
      envMap?.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
