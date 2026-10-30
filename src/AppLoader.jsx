import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;

export default function AppLoader({ loading }) {
  const [mounted, setMounted] = useState(true);
  const [webglUnavailable, setWebglUnavailable] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const overlayRef = useRef(null);
  const markRef = useRef(null);
  const copyRef = useRef(null);
  const sceneRootRef = useRef(null);

  useEffect(() => {
    const host = sceneRootRef.current;
    if (!host) return undefined;

    let renderer;
    let animationFrame = 0;
    let mixer;
    let texture;
    let geometry;
    let material;
    let ringGeometry;
    let ringMaterial;
    let resizeObserver;
    let windowResizeHandler;
    let disposed = false;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('three').then((THREE) => {
      if (disposed) return;

      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
        camera.position.z = 3.1;

        const logoGroup = new THREE.Group();
        scene.add(logoGroup);

        texture = new THREE.TextureLoader().load(
          logoUrl,
          () => {
            if (disposed) return;
            setWebglUnavailable(false);
            renderer.render(scene, camera);
          },
          undefined,
          () => { if (!disposed) setWebglUnavailable(true); },
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        geometry = new THREE.PlaneGeometry(1.05, 1.05);
        material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        logoGroup.add(new THREE.Mesh(geometry, material));

        ringGeometry = new THREE.TorusGeometry(0.79, 0.014, 8, 80);
        ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc8ea78, transparent: true, opacity: 0.72 });
        const halo = new THREE.Mesh(ringGeometry, ringMaterial);
        halo.position.z = -0.08;
        logoGroup.add(halo);

        mixer = new THREE.AnimationMixer(logoGroup);
        const turnTrack = new THREE.NumberKeyframeTrack('.rotation[y]', [0, 1.1, 2.2], [0, 0.16, 0]);
        const liftTrack = new THREE.NumberKeyframeTrack('.position[y]', [0, 1.1, 2.2], [0, 0.055, 0]);
        const idleClip = new THREE.AnimationClip('roomtone-logo-idle', 2.2, [turnTrack, liftTrack]);
        if (!prefersReducedMotion) mixer.clipAction(idleClip).play();

        const resize = () => {
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height || !renderer) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };

        resize();
        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
        } else {
          windowResizeHandler = resize;
          window.addEventListener('resize', windowResizeHandler);
        }

        const clock = new THREE.Clock();
        const render = () => {
          if (disposed) return;
          animationFrame = window.requestAnimationFrame(render);
          if (!prefersReducedMotion) mixer.update(clock.getDelta());
          renderer.render(scene, camera);
        };
        if (!prefersReducedMotion) render();
        setSceneReady(true);
      } catch {
        setWebglUnavailable(true);
        setSceneReady(true);
      }
    }).catch(() => {
      if (disposed) return;
      setWebglUnavailable(true);
      setSceneReady(true);
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      if (windowResizeHandler) window.removeEventListener('resize', windowResizeHandler);
      mixer?.stopAllAction();
      if (mixer) mixer.uncacheRoot(mixer.getRoot());
      geometry?.dispose();
      material?.dispose();
      ringGeometry?.dispose();
      ringMaterial?.dispose();
      texture?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (loading || !sceneReady || !overlayRef.current) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fade = gsap.to(overlayRef.current, {
      autoAlpha: 0,
      duration: reduced ? 0 : 0.32,
      ease: 'power2.out',
      onComplete: () => setMounted(false),
    });

    return () => fade.kill();
  }, [loading, sceneReady]);

  useEffect(() => {
    if (!overlayRef.current || !markRef.current || !copyRef.current) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      intro.fromTo(markRef.current, { autoAlpha: 0, scale: 0.86, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: reduced ? 0 : 0.42 });
      intro.fromTo(copyRef.current, { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.3 }, '-=0.15');

      if (!reduced) {
        gsap.to(markRef.current, { y: -3, scale: 1.025, duration: 1.25, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.42 });
      }
    }, overlayRef);

    return () => context.revert();
  }, []);

  if (!mounted) return null;

  return (
    <div className="app-loader" ref={overlayRef} role="status" aria-live="polite" aria-label="Loading Roomtone">
      <div className="app-loader-content">
        <div className="app-loader-mark" ref={markRef}>
          <div className="app-loader-scene" ref={sceneRootRef} aria-hidden="true" />
          {webglUnavailable && <img className="app-loader-fallback-logo" src={logoUrl} alt="" />}
        </div>
        <div className="app-loader-copy" ref={copyRef}>
          <strong>roomtone<span>.</span></strong>
          <small>Opening your workspace</small>
        </div>
        <span className="app-loader-status">Your recordings stay on this device</span>
      </div>
    </div>
  );
}
