import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Slow-turning DNA helix. Camera distance is derived from container size so the
 * full double-helix (both strands + rungs) is always readable, whether it sits
 * in a tall hero (/dna) or a compact panel (Index "Im Hintergrund").
 */
export function HelixScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fov = 30;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 5);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(-3, -2, -4);
    scene.add(rim);

    const group = new THREE.Group();
    const steps = 80;
    const turns = 4;
    const radius = 1.6;
    const height = 6.4;
    const cubeGeom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xefebe1, roughness: 0.6 });
    const rungMat = new THREE.MeshStandardMaterial({ color: 0x7c7972, roughness: 0.6 });
    const rungGeom = new THREE.CylinderGeometry(0.025, 0.025, radius * 2, 12);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const y = (t - 0.5) * height;
      const a = t * Math.PI * 2 * turns;
      const a2 = a + Math.PI;
      const c1 = new THREE.Mesh(cubeGeom, black);
      const c2 = new THREE.Mesh(cubeGeom, white);
      c1.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      c2.position.set(Math.cos(a2) * radius, y, Math.sin(a2) * radius);
      group.add(c1, c2);
      if (i % 5 === 0) {
        const rung = new THREE.Mesh(rungGeom, rungMat);
        rung.position.set(0, y, 0);
        rung.rotation.z = Math.PI / 2;
        rung.rotation.y = a;
        group.add(rung);
      }
    }
    scene.add(group);

    /**
     * Frame the helix so the full form fits with 15% padding.
     * We use the *vertical* fov and derive a base distance from the helix height,
     * then widen by aspect ratio to keep it visible in wide/narrow containers.
     */
    function frame() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.aspect = aspect;
      const vFov = (fov * Math.PI) / 180;
      const distV = (height * 0.62) / Math.tan(vFov / 2);
      const distH = (radius * 2.4) / Math.tan(vFov / 2) / aspect;
      const dist = Math.max(distV, distH) * 1.05;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
    frame();

    let scroll = 0;
    const onScroll = () => { scroll = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => frame();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.18 + scroll * 0.0008;
      group.rotation.x = Math.sin(t * 0.22) * 0.04;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      renderer.dispose();
      cubeGeom.dispose();
      rungGeom.dispose();
      black.dispose();
      white.dispose();
      rungMat.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
