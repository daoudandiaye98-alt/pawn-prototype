import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PalaceLayout } from "@/components/palace/PalaceLayout";

function LonelyPawn() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = el.clientWidth, h = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 0.3, 4.5);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 5, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xf1eee7, 0.5); rim.position.set(-3, 2, -2); scene.add(rim);

    const profile = [[0,-1.5],[0.78,-1.5],[0.82,-1.34],[0.5,-1.2],[0.42,-0.6],[0.3,-0.1],[0.26,0.3],[0.42,0.44],[0.42,0.56],[0.24,0.66],[0,0.66]]
      .map(([x,y]) => new THREE.Vector2(x,y));
    const geom = new THREE.LatheGeometry(profile, 48);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.35, metalness: 0.12 });
    const body = new THREE.Mesh(geom, mat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), mat); head.position.y = 1;
    const group = new THREE.Group(); group.add(body, head); group.scale.setScalar(0.9); scene.add(group);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128; shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext("2d");
    if (sctx) {
      const g = sctx.createRadialGradient(64,64,4,64,64,64);
      g.addColorStop(0,"rgba(0,0,0,0.5)"); g.addColorStop(1,"rgba(0,0,0,0)");
      sctx.fillStyle = g; sctx.fillRect(0,0,128,128);
    }
    const tex = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI/2; shadow.position.y = -1.55; scene.add(shadow);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      if (!reduced) group.rotation.y = t * 0.4;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight;
      renderer.setSize(nw, nh); camera.aspect = nw/nh; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose(); geom.dispose(); mat.dispose(); tex.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);
  return <div ref={ref} className="mx-auto h-[280px] w-[280px]" aria-hidden />;
}

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error("404: Route nicht gefunden:", location.pathname);
    document.title = "404 — PAWN";
  }, [location.pathname]);

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto flex min-h-[80vh] max-w-[900px] flex-col items-center justify-center px-6 py-32 text-center">
        <LonelyPawn />
        <p className="palace-eyebrow mt-2">404</p>
        <h1
          className="palace-serif mt-6 font-light text-[#000000]"
          style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          Dieser Raum <span className="italic">existiert nicht.</span>
        </h1>
        <p className="mt-8 max-w-md font-serif italic text-[1.05rem] text-[#000000]/75">
          Vielleicht wurde er verschoben, umbenannt, oder du bist einer alten Adresse gefolgt.
        </p>
        <Link
          to="/"
          className="mt-12 inline-flex border border-[#000000] px-8 py-3 text-[0.65rem] uppercase tracking-[0.42em] text-[#000000] transition-colors hover:bg-[#000000] hover:text-[#FFFFFF]"
        >
          Zurück zur Ausstellung
        </Link>
      </section>
    </PalaceLayout>
  );
};

export default NotFound;
