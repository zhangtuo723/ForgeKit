"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import styles from "./workspace-scene.module.css";
import { createHarbor, harborPlaces } from "./harbor-model";

type Section = "about" | "work" | "journey";
type Props = { theme: "light" | "dark"; playing: boolean; resetToken: number; focused?: Section | null; onSelect: (section: Section) => void };
type Handle = { refresh: () => void; reset: () => void; highlight: (id: Section | null) => void };
const landmarks = harborPlaces;

export default function WorkspaceScene({theme,playing,resetToken,focused=null,onSelect}:Props){
  const mountRef=useRef<HTMLDivElement>(null),pinRefs=useRef<Partial<Record<Section,HTMLButtonElement|null>>>({});
  const options=useRef({theme,playing,focused,onSelect}),handle=useRef<Handle|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"fallback">("loading");
  useEffect(()=>{options.current={theme,playing,focused,onSelect};handle.current?.refresh();},[theme,playing,focused,onSelect]);
  useEffect(()=>{handle.current?.reset();},[resetToken]);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});}catch{setStatus("fallback");return;}
    const scene=new THREE.Scene(),background=new THREE.Color("#263d46");scene.background=background;scene.fog=new THREE.Fog(background,45,125);
    const camera=new THREE.PerspectiveCamera(38,1,.1,160);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    const canvas=renderer.domElement;canvas.className=styles.canvas;canvas.tabIndex=0;canvas.setAttribute("aria-label","DDS 的微缩城市。拖动旋转，右键拖动平移，滚轮缩放。点按画布后可用 WASD 漫游、方向键旋转、Home 复位。点击地标探索简历。");mount.appendChild(canvas);
    const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.enablePan=true;controls.enableZoom=true;controls.screenSpacePanning=false;
    controls.minDistance=12;controls.maxDistance=56;controls.minPolarAngle=.48;controls.maxPolarAngle=1.32;controls.rotateSpeed=.42;controls.panSpeed=.65;controls.zoomSpeed=.6;
    const city=createHarbor();scene.add(city.group);
    const ambient=new THREE.HemisphereLight(0xb6cad1,0x38484b,2),sun=new THREE.DirectionalLight(0xffe2b4,3.2);sun.position.set(-12,22,14);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.camera.near=.5;sun.shadow.camera.far=65;sun.shadow.normalBias=.05;sun.shadow.bias=-.0002;sun.shadow.radius=3;
    const fill=new THREE.DirectionalLight(0x9fbdc6,.8);fill.position.set(12,8,-10);scene.add(ambient,sun,fill);
    // Signage belongs to the buildings. These small local canvases stay crisp
    // without downloading a font/texture or adding dozens of text meshes.
    const signs: {texture:THREE.CanvasTexture;material:THREE.Material;geometry:THREE.BufferGeometry}[]=[];
    for(const data of [
      {text:"D D S  /  O B S E R V A T O R Y",at:[-4.5,3.02,.34],width:2.2,angle:.38},
      {text:"C A N V A S   A T E L I E R",at:[1.25,2.66,-.14],width:3.2,angle:0},
      {text:"S N A P B O O T H",at:[6.25,2.8,4.13],width:2.2,angle:0},
      {text:"2 0 2 4",at:[-7,1.42,3.39],width:.46,angle:-.18},
      {text:"2 0 2 5",at:[-4.6,1.75,4.39],width:.46,angle:-.18},
      {text:"N O W",at:[-2,2.04,4.44],width:.46,angle:-.18},
    ]){
      const surface=document.createElement("canvas");surface.width=1024;surface.height=128;const ctx=surface.getContext("2d");if(!ctx)continue;
      ctx.fillStyle="#eee0c7";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="500 42px Arial";ctx.fillText(data.text,512,64,990);
      const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});const geometry=new THREE.PlaneGeometry(data.width,data.width/8);
      const sign=new THREE.Mesh(geometry,material);sign.position.set(data.at[0],data.at[1],data.at[2]);sign.rotation.y=data.angle;scene.add(sign);signs.push({texture,material,geometry});
    }
    // Pick architectural proxies, never the hundreds of facade/foliage parts.
    const pickAreas:{section:Section;bounds:THREE.Box3}[]=[
      {section:"about",bounds:new THREE.Box3(new THREE.Vector3(-8.5,.63,-5.3),new THREE.Vector3(-2.7,5.8,.5))},
      {section:"work",bounds:new THREE.Box3(new THREE.Vector3(-1.6,.63,-5),new THREE.Vector3(4.5,4,-.1))},
      {section:"work",bounds:new THREE.Box3(new THREE.Vector3(3.4,.63,.9),new THREE.Vector3(9.1,3.2,4.3))},
      {section:"journey",bounds:new THREE.Box3(new THREE.Vector3(-7.6,.63,2.8),new THREE.Vector3(-1.3,2.7,4.8))},
    ];
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),projected=new THREE.Vector3(),down=new THREE.Vector2(),movePoint=new THREE.Vector2(),hitPoint=new THREE.Vector3();
    const desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),panShift=new THREE.Vector3();
    let frame=0,timer:ReturnType<typeof setTimeout>|null=null,disposed=false,lost=false,onScreen=true,dragging=false,moved=false;
    let width=1,height=1,mobile=false,lastTime=0,elapsed=0,lastHoverTime=0,pinsDirty=true,transitioning=false;
    let lastTheme="",lastFocus:Section|null|undefined=undefined,active:Section|null=null;
    const pinTransforms=new Map<Section,string>(),reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    function cancelTimer(){if(timer!==null){clearTimeout(timer);timer=null;}}
    function requestFrame(){cancelTimer();if(!frame&&!disposed&&!lost&&onScreen&&!document.hidden)frame=requestAnimationFrame(render);}
    function focusView(){
      const focus=options.current.focused;
      if(focus){const point=landmarks.find(item=>item.id===focus)!.point;desiredTarget.copy(point).add(new THREE.Vector3(mobile?0:3.5,mobile?-4.3:.1,0));desiredPosition.copy(desiredTarget).add(new THREE.Vector3(mobile?13:14,mobile?14:10,mobile?19:20));}
      else{desiredTarget.set(mobile?0:-3.6,mobile?0:1,mobile?1:.8);desiredPosition.copy(desiredTarget).add(new THREE.Vector3(mobile?27:25.6,mobile?30:17,mobile?38:28.2));}
      // Focus destinations and manual movement must share bounds, otherwise
      // lerping toward an unreachable point would keep rendering forever.
      panShift.set(THREE.MathUtils.clamp(desiredTarget.x,-10,10)-desiredTarget.x,THREE.MathUtils.clamp(desiredTarget.y,-5,6)-desiredTarget.y,THREE.MathUtils.clamp(desiredTarget.z,-10,10)-desiredTarget.z);
      desiredTarget.add(panShift);desiredPosition.add(panShift);
      desiredPosition.sub(desiredTarget).clampLength(controls.minDistance,controls.maxDistance).add(desiredTarget);
      lastFocus=focus;transitioning=true;pinsDirty=true;
      if(reduced.matches){camera.position.copy(desiredPosition);controls.target.copy(desiredTarget);controls.update();transitioning=false;}
    }
    function applyTheme(){const next=options.current.theme;if(next===lastTheme)return;lastTheme=next;const dark=next==="dark";background.set(dark?"#263d46":"#b5bfb4");(scene.fog as THREE.Fog).color.copy(background);ambient.color.set(dark?"#b6cad1":"#e5eeed");ambient.groundColor.set(dark?"#38484b":"#757866");ambient.intensity=dark?1.7:2.3;sun.color.set(dark?"#ffe2b4":"#fff2dd");sun.intensity=dark?3:3.4;city.updateTheme(dark);renderer.shadowMap.needsUpdate=true;}
    function placePins(){
      if(!pinsDirty||options.current.focused)return;pinsDirty=false;
      const placed:{x:number;y:number}[]=[],minY=Math.min(100,height*.25),maxY=Math.max(minY,height-70);
      landmarks.forEach(({id,anchor})=>{
        const button=pinRefs.current[id];if(!button)return;projected.copy(anchor).project(camera);
        const x=Math.max(64,Math.min(width-64,(projected.x*.5+.5)*width)),preferred=THREE.MathUtils.clamp((-projected.y*.5+.5)*height,minY,Math.max(minY,height-(mobile?230:110)));
        const candidates=[preferred,preferred+48,preferred-48,preferred+96,preferred-96].map(y=>THREE.MathUtils.clamp(y,minY,maxY));
        const y=candidates.find(candidate=>placed.every(p=>Math.abs(x-p.x)>=125||Math.abs(candidate-p.y)>=45))??preferred;
        placed.push({x,y});const transform=`translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-50%)`;
        if(pinTransforms.get(id)!==transform){button.style.transform=transform;pinTransforms.set(id,transform);}button.dataset.active=String(active===id);
      });
    }
    function render(time:number){frame=0;if(disposed||lost||!onScreen||document.hidden){lastTime=0;return;}const delta=lastTime?Math.min((time-lastTime)/1000,.12):1/30;lastTime=time;applyTheme();if(lastFocus!==options.current.focused)focusView();if(transitioning){const blend=reduced.matches?1:1-Math.exp(-delta*5);camera.position.lerp(desiredPosition,blend);controls.target.lerp(desiredTarget,blend);controls.update();pinsDirty=true;if(camera.position.distanceToSquared(desiredPosition)<.0004&&controls.target.distanceToSquared(desiredTarget)<.0004)transitioning=false;}
      const animate=options.current.playing&&!reduced.matches;if(animate){elapsed+=delta;city.animate(elapsed);}renderer.render(scene,camera);placePins();
      if(transitioning)requestFrame();else if(animate)timer=setTimeout(()=>{timer=null;requestFrame();},33);
    }
    function controlsChanged(){const target=controls.target;panShift.set(THREE.MathUtils.clamp(target.x,-10,10)-target.x,THREE.MathUtils.clamp(target.y,-5,6)-target.y,THREE.MathUtils.clamp(target.z,-10,10)-target.z);target.add(panShift);camera.position.add(panShift);pinsDirty=true;requestFrame();}
    function highlight(id:Section|null){if(active===id)return;active=id;canvas.style.cursor=id?"pointer":dragging?"grabbing":"grab";for(const item of landmarks){const button=pinRefs.current[item.id];if(button)button.dataset.active=String(item.id===id);}}
    function pick(event:PointerEvent):Section|null{const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);let nearest=Infinity,id:Section|null=null;for(const area of pickAreas){if(ray.ray.intersectBox(area.bounds,hitPoint)){const distance=hitPoint.distanceToSquared(ray.ray.origin);if(distance<nearest){nearest=distance;id=area.section;}}}return id;}
    function pointerDown(event:PointerEvent){down.set(event.clientX,event.clientY);moved=false;}
    function pointerMove(event:PointerEvent){movePoint.set(event.clientX,event.clientY);if(dragging){if(down.distanceTo(movePoint)>6)moved=true;return;}if(event.pointerType!=="mouse"||performance.now()-lastHoverTime<100)return;lastHoverTime=performance.now();highlight(pick(event));}
    function pointerUp(event:PointerEvent){movePoint.set(event.clientX,event.clientY);if(event.button!==0||moved||down.distanceTo(movePoint)>6)return;const id=pick(event);if(id)options.current.onSelect(id);}
    function pointerLeave(){highlight(null);}
    function startDrag(){dragging=true;transitioning=false;cancelTimer();canvas.style.cursor="grabbing";}
    function endDrag(){dragging=false;canvas.style.cursor=active?"pointer":"grab";requestFrame();}
    function reset(){focusView();requestFrame();}
    function keyDown(event:KeyboardEvent){const key=event.key.toLowerCase();if(!["w","a","s","d","arrowleft","arrowright","arrowup","arrowdown","home"].includes(key))return;event.preventDefault();if(key==="home"){reset();return;}transitioning=false;
      if(["w","a","s","d"].includes(key)){const forward=controls.target.clone().sub(camera.position);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize(),direction=key==="w"?forward:key==="s"?forward.negate():key==="d"?right:right.negate();direction.multiplyScalar(event.shiftKey?.9:.45);camera.position.add(direction);controls.target.add(direction);}
      else{const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);if(key==="arrowleft")spherical.theta-=.08;if(key==="arrowright")spherical.theta+=.08;if(key==="arrowup")spherical.phi-=.05;if(key==="arrowdown")spherical.phi+=.05;spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));}controls.update();controlsChanged();}
    function resize(){width=mount!.clientWidth;height=mount!.clientHeight;if(!width||!height)return;mobile=width<700;camera.aspect=width/height;camera.fov=mobile?48:36;camera.updateProjectionMatrix();renderer.setPixelRatio(mobile?1:Math.min(window.devicePixelRatio||1,1.35));renderer.setSize(width,height);focusView();camera.position.copy(desiredPosition);controls.target.copy(desiredTarget);controls.update();transitioning=false;pinsDirty=true;pinTransforms.clear();requestFrame();}
    function visibility(){lastTime=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;cancelTimer();}else requestFrame();}
    function contextLost(event:Event){event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;cancelTimer();setStatus("fallback");}
    function contextRestored(){lost=false;pinsDirty=true;renderer.shadowMap.needsUpdate=true;setStatus("ready");requestFrame();}
    const observer=new ResizeObserver(resize);observer.observe(mount);const intersection=new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting??true;lastTime=0;if(!onScreen){cancelAnimationFrame(frame);frame=0;cancelTimer();}else requestFrame();});intersection.observe(mount);
    canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointermove",pointerMove);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("pointerleave",pointerLeave);canvas.addEventListener("keydown",keyDown);canvas.addEventListener("webglcontextlost",contextLost);canvas.addEventListener("webglcontextrestored",contextRestored);
    controls.addEventListener("change",controlsChanged);controls.addEventListener("start",startDrag);controls.addEventListener("end",endDrag);document.addEventListener("visibilitychange",visibility);reduced.addEventListener("change",requestFrame);
    handle.current={refresh:()=>{pinsDirty=true;pinTransforms.clear();requestFrame();},reset,highlight};resize();setStatus("ready");requestFrame();
    return()=>{disposed=true;cancelAnimationFrame(frame);cancelTimer();handle.current=null;observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener("change",requestFrame);
      canvas.removeEventListener("pointerdown",pointerDown);canvas.removeEventListener("pointermove",pointerMove);canvas.removeEventListener("pointerup",pointerUp);canvas.removeEventListener("pointerleave",pointerLeave);canvas.removeEventListener("keydown",keyDown);canvas.removeEventListener("webglcontextlost",contextLost);canvas.removeEventListener("webglcontextrestored",contextRestored);controls.removeEventListener("change",controlsChanged);controls.removeEventListener("start",startDrag);controls.removeEventListener("end",endDrag);controls.dispose();
      city.dispose();signs.forEach(sign=>{sign.texture.dispose();sign.material.dispose();sign.geometry.dispose();});sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();scene.clear();canvas.remove();};
  },[]);
  return <div className={styles.scene} data-theme={theme} data-status={status} data-focused={focused||undefined}><div className={styles.mount} ref={mountRef} aria-hidden={status==="fallback"||undefined}/>
    {status!=="ready"&&<div className={styles.fallback} role="status"><p>{status==="fallback"?"当前设备暂以场景封面展示，可通过导航阅读完整简历。":"正在走进 DDS 的创意港湾…"}</p></div>}
    {!focused&&<div className={status==="ready"?styles.hotspots:styles.fallbackLinks} aria-label="城市地标">{landmarks.map(({id,label,number})=><button type="button" key={id} className={styles.hotspot} ref={element=>{pinRefs.current[id]=element;}} onClick={()=>onSelect(id)} onMouseEnter={()=>handle.current?.highlight(id)} onMouseLeave={()=>handle.current?.highlight(null)} onFocus={()=>handle.current?.highlight(id)} onBlur={()=>handle.current?.highlight(null)}><span>{number}</span><span>{label}</span><span className={styles.arrow} aria-hidden="true">↗</span></button>)}</div>}
  </div>;
}
