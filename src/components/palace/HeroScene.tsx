import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Marble chessboard + black lathed pawn. The board breathes in a soft wave.
 * On scroll, the whole canvas fades to a ghost (opacity .07) so page content owns the eye.
 * The signature scene re-invokes full opacity when `finaleActive` is true, and morphs
 * the pawn silhouette into a queen for the closing frame.
 */
export function HeroScene({ finaleProgress = 0 }: { finaleProgress?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ finale: 0, scroll: 0 });

  useEffect(() => {
    stateRef.current.finale = finaleProgress;
  }, [finaleProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf1eee7, 0.055);
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 2.1, 10.5);
    camera.lookAt(0, 0, 0);

    // Lights — soft ambient + a warm rim.
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(4, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf1eee7, 0.6);
    rim.position.set(-4, 3, -2);
    scene.add(rim);

    // Chessboard — 21x21 tiles, breathing wave.
    const boardGroup = new THREE.Group();
    boardGroup.position.y = -2.2;
    const N = 21;
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

    // Pawn silhouette (lathe).
    const pawnProfile = [
      [0, -1.5], [0.78, -1.5], [0.82, -1.34], [0.5, -1.2],
      [0.42, -0.6], [0.3, -0.1], [0.26, 0.3],
      [0.42, 0.44], [0.42, 0.56], [0.24, 0.66], [0, 0.66],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pawnGeom = new THREE.LatheGeometry(pawnProfile, 64);
    const pieceMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.35, metalness: 0.1 });
    const pawnMesh = new THREE.Mesh(pawnGeom, pieceMat);
    const pawnHead = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), pieceMat);
    pawnHead.position.y = 1;
    const pawnGroup = new THREE.Group();
    pawnGroup.add(pawnMesh, pawnHead);
    scene.add(pawnGroup);

    // Queen silhouette — hidden until finale.
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

    // Mouse parallax.
    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);

    const onResize = () => {
      if (!container) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const onScroll = () => {
      stateRef.current.scroll = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      // Board breathing.
      for (const { mesh, dist } of tiles) {
        mesh.position.y = Math.sin(t * 0.85 - dist * 0.5) * 0.04;
      }
      // Pawn/queen rotations.
      pawnGroup.rotation.y = t * 0.2;
      queenGroup.rotation.y = t * 0.2 + stateRef.current.finale * Math.PI * 3;
      // Morph.
      const f = stateRef.current.finale;
      pawnGroup.scale.setScalar(1 - f);
      (pawnMesh.material as THREE.MeshStandardMaterial).opacity = 1 - f;
      (pawnMesh.material as THREE.MeshStandardMaterial).transparent = true;
      queenGroup.scale.setScalar(f);
      // Camera parallax.
      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (2.1 + mouse.y * 0.3 - camera.position.y) * 0.03;
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
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
