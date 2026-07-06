import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Slow-turning DNA helix in monochrome cubes. Rotation driven by scroll. */
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
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(3, 4, 5);
    scene.add(dir);

    const group = new THREE.Group();
    const steps = 64;
    const turns = 5;
    const radius = 1.35;
    const height = 5;
    const cubeGeom = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0e });
    const white = new THREE.MeshStandardMaterial({ color: 0xefebe1 });
    const rungMat = new THREE.MeshStandardMaterial({ color: 0x7c7972 });
    const rungGeom = new THREE.CylinderGeometry(0.02, 0.02, radius * 2, 12);
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
      if (i % 6 === 0) {
        const rung = new THREE.Mesh(rungGeom, rungMat);
        rung.position.set(0, y, 0);
        rung.rotation.z = Math.PI / 2;
        rung.rotation.y = a;
        group.add(rung);
      }
    }
    scene.add(group);

    let scroll = 0;
    const onScroll = () => { scroll = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.15 + scroll * 0.001;
      group.rotation.x = Math.sin(t * 0.2) * 0.05;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
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
