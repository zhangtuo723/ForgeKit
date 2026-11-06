import * as THREE from "three";

/** An authored architectural maquette. All coordinates are in metres.
 * Repeated facade parts share meshes; the three buildings have distinct profiles.
 * No network assets, physics engine, screen-space effects or per-frame geometry. */
export function createHarbor() {
  const group = new THREE.Group();
  group.name = "DDS — The Creative Harbour";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const keep = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const material = (color: string, roughness = .85, metalness = 0) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(value); return value;
  };
  const stone = material("#c8c3b5"), edge = material("#888c86"), basalt = material("#33454a");
  const concrete = material("#d5d1c5"), roof = material("#536266", .72, .15), ink = material("#273c42", .55, .2);
  const bronze = material("#96836a", .65, .25), wood = material("#8c7760"), moss = material("#65786c");
  const foliage = [material("#667f78"), material("#8b9b82"), material("#4c6e68")];
  const glass = material("#8e9b94", .28, .32); glass.emissive.set("#e1b984"); glass.emissiveIntensity = .34;
  const window = material("#d5ba8d", .45, .08); window.emissive.set("#ffd49a"); window.emissiveIntensity = .7;
  const glow = new THREE.MeshBasicMaterial({ color: "#f4d09c" }); materials.add(glow);
  // A tiny deterministic grain gives the stone a tactile surface at close range.
  const grain = new Uint8Array(128*128*4); let seed = 2026;
  for(let i=0;i<128*128;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=205+(seed%46);grain.set([v,v,v,255],i*4);}
  const stoneTexture=new THREE.DataTexture(grain,128,128);stoneTexture.wrapS=stoneTexture.wrapT=THREE.RepeatWrapping;stoneTexture.repeat.set(3,3);stoneTexture.needsUpdate=true;textures.add(stoneTexture);
  for(const surface of [stone,edge,basalt,concrete]){surface.bumpMap=stoneTexture;surface.bumpScale=.018;surface.roughnessMap=stoneTexture;}
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const roundGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 48));
  const poleGeo = keep(new THREE.CylinderGeometry(.7, 1, 1, 7));
  const leafGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  type Part = { matrix: THREE.Matrix4; color?: THREE.Color };
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; parts: Part[]; shadow: boolean }>();
  const transform = new THREE.Object3D();
  function part(geometry: THREE.BufferGeometry, mat: THREE.Material, at: number[], scale: number[], rotation = [0, 0, 0], shadow = true) {
    transform.position.set(at[0], at[1], at[2]); transform.scale.set(scale[0], scale[1], scale[2]); transform.rotation.set(rotation[0], rotation[1], rotation[2]); transform.updateMatrix();
    const key = `${geometry.uuid}:${mat.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { geometry, material: mat, parts: [], shadow });
    batches.get(key)!.parts.push({ matrix: transform.matrix.clone() });
  }
  function box(mat: THREE.Material, at: number[], scale: number[], rotation = [0, 0, 0], shadow = true) { part(boxGeo, mat, at, scale, rotation, shadow); }
  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, at = [0, 0, 0], shadow = true) {
    const value = new THREE.Mesh(geometry, mat); value.position.set(at[0], at[1], at[2]); value.castShadow = shadow; value.receiveShadow = true; group.add(value); return value;
  }
  function outline(points: number[][], thickness: number, bevel = 0) {
    const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geometry = keep(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 }));
    geometry.rotateX(-Math.PI / 2); return geometry;
  }
  function beam(mat: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const delta = to.clone().sub(from); transform.position.copy(from).addScaledVector(delta, .5); transform.scale.set(radius, delta.length(), radius); transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); transform.updateMatrix();
    const key = `${poleGeo.uuid}:${mat.uuid}:true`;
    if (!batches.has(key)) batches.set(key, { geometry: poleGeo, material: mat, parts: [], shadow: true });
    batches.get(key)!.parts.push({ matrix: transform.matrix.clone() });
  }

  // Three offset, chamfered layers give the shoreline a believable retaining edge.
  const shore = [[-11,-5.5],[-8.7,-8],[3,-8],[10,-4.5],[12,1],[10.6,5.5],[6.4,7.4],[-3,7.4],[-9.8,4.3],[-11,1]];
  mesh(outline(shore, .65, .12), basalt, [0,-.32,0]);
  mesh(outline(shore.map(([x,z]) => [x*.985,z*.985]), .22, .04), edge, [0,.33,0]);
  mesh(outline(shore.map(([x,z]) => [x*.965,z*.965]), .08), stone, [0,.55,0]);
  const ground = .63;
  // Broad stone steps let the promenade meet the water instead of floating.
  for(let i=0;i<4;i++)box(concrete,[-.25,.08+i*.135,7.65-i*.22],[6.6,.14,.42],[0,0,0]);
  for(let i=0;i<3;i++)box(glow,[-.25,.155+i*.135,7.85-i*.22],[2.8,.012,.018],[0,0,0],false);

  // Paving is laid along the waterfront, with a few long seams, not a city grid.
  for (let i = 0; i < 16; i++) box(edge, [-5.2+i*.9,ground+.005,5.75], [.018,.012,2.0], [0,-.08,0], false);
  box(edge, [1,ground+.008,4.7], [16,.014,.025], [0,-.08,0], false);
  for (let i = 0; i < 8; i++) box(edge, [-1.3+i*1.25,ground+.005,1.8], [.015,.012,2.5], [0,-.08,0], false);

  // AIGC GALLERY: curved glass drum, recessed lobby, bronze fins and a deep roof.
  const gx = -5.6, gz = -2.4, radius = 2.85;
  part(roundGeo, ink, [gx,ground+2.24,gz], [radius,4.48,radius]);
  part(roundGeo, glass, [gx,ground+2.37,gz], [radius+.015,3.68,radius+.015]);
  part(roundGeo, roof, [gx,ground+4.46,gz], [radius+.32,.2,radius+.32]);
  part(roundGeo, concrete, [gx,ground+4.61,gz], [radius+.39,.12,radius+.39]);
  part(roundGeo, ink, [gx,ground+4.7,gz], [radius-.24,.055,radius-.24]);
  part(roundGeo, bronze, [gx,ground+.42,gz], [radius+.16,.06,radius+.16]);
  part(roundGeo, bronze, [gx,ground+2.45,gz], [radius+.05,.075,radius+.05]);
  part(roundGeo, concrete, [gx,ground+.13,gz], [radius+.34,.26,radius+.34]);
  for (let i = 0; i < 40; i++) {
    const a = i*Math.PI*2/40;
    box(bronze, [gx+Math.sin(a)*(radius+.08),ground+2.4,gz+Math.cos(a)*(radius+.08)], [.065,4.03,.14], [0,a,0]);
  }
  // A roof garden and one asymmetric architectural fin create the silhouette.
  part(roundGeo, moss, [gx-.4,ground+4.75,gz-.25], [1.38,.075,1.38]);
  box(concrete, [gx-1.4,ground+2.6,gz-1.4], [.26,5.2,2.8], [0,-.32,0]);
  box(ink, [gx+1.15,ground+.87,gz+2.3], [1.25,1.6,.28], [0,-.45,0]);
  box(glow, [gx+.99,ground+1.73,gz+2.45], [1.15,.025,.08], [0,-.45,0], false);
  for (let i=0; i<4; i++) box(concrete,[gx+.4,ground-.02+i*.06,gz+3.05-i*.17],[2.0,.12,.4],[0,-.12,0]);

  // CANVAS ATELIER: a northern-light sawtooth roof over a warm open studio.
  const ax = 1.25, az = -2.55, aw = 5.6, ad = 4.7, ah = 2.25;
  box(ink, [ax,ground+.15,az], [aw+.3,.3,ad+.3]);
  box(glass, [ax,ground+ah/2+.15,az], [aw,ah,ad]);
  box(concrete, [ax,ground+ah/2+.15,az-ad/2], [aw,ah,.16]);
  box(concrete, [ax-aw/2,ground+ah/2+.15,az], [.2,ah,ad]);
  for (let i = 0; i < 10; i++) box(bronze, [ax-aw/2+i*aw/9,ground+1.32,az+ad/2+.04], [.065,2.4,.09]);
  box(bronze, [ax,ground+1.12,az+ad/2+.04], [aw,.06,.09]);
  for (let i = 0; i < 3; i++) {
    const left = ax-aw/2+i*aw/3, rw=aw/3;
    const profile = new THREE.Shape(); profile.moveTo(0,0); profile.lineTo(rw,0); profile.lineTo(rw,.13); profile.lineTo(.12,1.08); profile.lineTo(0,1.08); profile.closePath();
    const g = keep(new THREE.ExtrudeGeometry(profile,{depth:ad+.28,bevelEnabled:false,steps:1,curveSegments:1}));
    mesh(g, roof, [left,ground+ah+.17,az-ad/2-.14]);
    box(glass, [left+.07,ground+ah+.72,az], [.08,.85,ad]);
    box(bronze,[left+.04,ground+ah+.7,az+ad/2],[.06,1.08,.06]);
    box(glow,[left+rw*.5,ground+ah+.14,az+ad/2+.15],[rw-.08,.022,.024],[0,0,0],false);
  }
  // The low side wing / outdoor workstation breaks the large rectangular mass.
  box(concrete, [ax+aw/2+.55,ground+.62,az+.4], [1.1,1.24,2.8]);
  box(roof, [ax+aw/2+.55,ground+1.3,az+.4], [1.3,.12,3]);
  for(let i=0;i<4;i++) {
    box(wood,[ax-1.7+i*1.05,ground+.52,az+1.1],[.7,.08,.5]);
    box(ink,[ax-1.7+i*1.05,ground+.27,az+1.1],[.07,.5,.07]);
  }

  // SNAPBOOTH PAVILION: horizontal limestone mass with a circular picture window.
  const px=6.25,pz=2.55;
  box(concrete,[px,ground+1.18,pz],[5.35,2.36,3.1]);
  box(ink,[px,ground+1.15,pz+1.57],[4.85,1.9,.035]);
  box(glass,[px-1.47,ground+1.14,pz+1.6],[1.25,1.72,.04]);
  for(let i=0;i<7;i++) box(bronze,[px-2.04+i*.2,ground+1.14,pz+1.65],[.035,1.84,.1]);
  const aperture=keep(new THREE.TorusGeometry(.8,.11,8,48));
  mesh(aperture,concrete,[px+.65,ground+1.23,pz+1.68]);
  const disc=keep(new THREE.CircleGeometry(.76,48));
  mesh(disc,glass,[px+.65,ground+1.23,pz+1.67],false);
  const innerRing=keep(new THREE.TorusGeometry(.71,.018,5,48));
  mesh(innerRing,bronze,[px+.65,ground+1.23,pz+1.7]);
  box(roof,[px,ground+2.43,pz],[5.8,.14,3.55]);
  box(concrete,[px,ground+2.53,pz],[5.72,.06,3.47]);
  box(glow,[px,ground+2.31,pz+1.67],[5.2,.025,.045],[0,0,0],false);
  box(concrete,[px,ground+.08,pz+1.82],[5.7,.16,.65]);
  box(concrete,[px,ground-.02,pz+2.13],[6,.12,.38]);

  // Three stones mark the career route: quiet, human-scale landmarks.
  const stones=[{x:-7,z:3.2,h:1.15},{x:-4.6,z:4.2,h:1.55},{x:-2,z:4.25,h:2.0}];
  for(const s of stones){
    box(concrete,[s.x,ground+s.h/2,s.z],[.7,s.h,.35],[0,-.18,0]);
    box(bronze,[s.x+.05,ground+s.h*.63,s.z+.2],[.37,.025,.025],[0,-.18,0],false);
    box(glow,[s.x,ground+.04,s.z+.5],[.64,.015,.045],[0,-.18,0],false);
  }
  for(let i=0;i<10;i++) box(edge,[-7.4+i*.68,ground+.007,4.8],[.45,.018,.15],[0,-.15,0],false);

  function tree(x:number,z:number,size:number,seed:number,y=ground){
    part(poleGeo,wood,[x,y+size*.58,z],[.095,size*1.16,.095]);
    for(let i=0;i<4;i++){
      const a=i*2.4+seed;
      const tx=x+Math.cos(a)*size*.32,tz=z+Math.sin(a)*size*.28;
      beam(wood,new THREE.Vector3(x,y+size*.58,z),new THREE.Vector3(tx,y+size*1.32,tz),.04);
      part(leafGeo,foliage[(i+seed)%3],[tx,y+size*(1.3+(i%2)*.15),tz],[size*.55,size*.44,size*.51],[0,a,.15]);
    }
    part(leafGeo,foliage[seed%3],[x,y+size*1.73,z],[size*.5,size*.43,size*.48],[0,seed,0]);
    part(roundGeo,basalt,[x,y+.025,z],[.5,.06,.5]);
  }
  tree(-9.1,-.4,1.6,1); tree(-8.65,1.4,1.35,2); tree(-8.6,-5.1,1.8,3);
  tree(-2.1,-6.0,1.55,4); tree(.3,-6.5,1.85,5); tree(6.15,-2.7,1.35,6);
  tree(8.85,-.7,1.6,7); tree(9.9,1.2,1.2,8); tree(-.1,2.0,1.15,9);
  tree(-6.1,-2.7,.62,2,ground+4.8); // Gallery roof garden.
  // Bushes, planters, seats and slender lamps make the promenade habitable.
  for(const [x,z] of [[-9,2.8],[-2.6,-6.9],[4.8,-4.9],[8.9,.2],[-.3,5.9]]){
    box(basalt,[x,ground+.18,z],[1.5,.36,.65]);
    for(let j=0;j<4;j++) part(leafGeo,foliage[j%3],[x-.5+j*.34,ground+.43,z],[.32,.3,.32]);
  }
  for(const [x,z,angle] of [[-5.6,5.6,-.1],[1.1,5.8,-.1],[-8.9,.3,1.3]]){
    for(let j=0;j<4;j++) box(wood,[x,ground+.38,z-.17+j*.11],[1.45,.065,.075],[0,angle,0]);
    for(const dx of [-.52,.52])box(ink,[x+dx,ground+.2,z],[.055,.4,.38],[0,angle,0]);
  }
  for(const [x,z] of [[-7.8,3.9],[-3.2,6],[2.8,5.9],[9.25,3.7],[-1.3,.3],[5,-4.8]]){
    part(poleGeo,ink,[x,ground+.95,z],[.035,1.9,.035]);
    box(ink,[x+.16,ground+1.91,z],[.38,.055,.11]);
    box(glow,[x+.16,ground+1.88,z],[.26,.016,.08],[0,0,0],false);
    // Soft amber pools are a tiny static texture-free gradient, never point lights.
    const ring=keep(new THREE.CircleGeometry(.55,24));
    const pool=new THREE.MeshBasicMaterial({color:"#edc184",transparent:true,opacity:.07,depthWrite:false});materials.add(pool);
    const p=mesh(ring,pool,[x+.15,ground+.012,z],false);p.rotation.x=-Math.PI/2;
  }

  // Floating pier, mooring posts and one small launch.
  box(ink,[6.1,.29,8.35],[2.15,.22,5.6]);
  for(let i=0;i<30;i++)box(wood,[6.1,.44,5.65+i*.18],[2.2,.065,.145]);
  for(const x of [5,7.2])for(const z of [6,8.1,10.7]){
    part(poleGeo,ink,[x,.3,z],[.085,1.35,.085]);
    part(roundGeo,bronze,[x,1,z],[.09,.05,.09]);
  }
  const boat=new THREE.Group();group.add(boat);boat.position.set(8.1,.18,9.0);boat.rotation.y=-.18;
  const hullGeo=outline([[-.62,-1.15],[.62,-1.15],[.63,.6],[.3,1.3],[0,1.6],[-.3,1.3],[-.63,.6]],.34,.05);
  const hull=new THREE.Mesh(hullGeo,concrete);hull.castShadow=true;boat.add(hull);
  const seat=new THREE.Mesh(boxGeo,wood);seat.position.set(0,.38,-.35);seat.scale.set(1.05,.07,.35);boat.add(seat);
  const cabin=new THREE.Mesh(boxGeo,ink);cabin.position.set(0,.48,.4);cabin.scale.set(.75,.35,.65);boat.add(cabin);

  // A subdued sea shader uses only a few sine waves. No reflection render pass.
  const waterMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uDark:{value:1},uColor:{value:new THREE.Color("#16343d")},uMist:{value:new THREE.Color("#263d46")}},
    vertexShader:`varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`varying vec3 vWorld; uniform float uTime; uniform float uDark; uniform vec3 uColor; uniform vec3 uMist;
      void main(){vec2 p=vWorld.xz;float waves=sin(p.x*2.1+p.y*1.6+uTime*.31)*sin(p.y*3.8-p.x*.3-uTime*.21);
      float fine=sin(p.x*11.+p.y*8.+uTime*.24)*.5+.5;float ridges=smoothstep(.62,1.,waves)*fine;
      float reflection=exp(-pow((p.x-p.y*.17-3.)*.18,2.))*smoothstep(1.,13.,p.y)*exp(-max(p.y-12.,0.)*.065);
      vec3 color=uColor+vec3(.038,.067,.071)*ridges+vec3(.28,.17,.075)*reflection*ridges*(.18+uDark*.45);
      float fog=1.-exp(-length(p)*.012);color=mix(color,uMist,fog);gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });materials.add(waterMaterial);
  const water=mesh(keep(new THREE.PlaneGeometry(240,240)),waterMaterial,[0,-.12,0],false);water.rotation.x=-Math.PI/2;

  batches.forEach(batch=>{
    const instanced=new THREE.InstancedMesh(batch.geometry,batch.material,batch.parts.length);
    batch.parts.forEach((p,i)=>instanced.setMatrixAt(i,p.matrix));instanced.instanceMatrix.needsUpdate=true;
    instanced.castShadow=batch.shadow;instanced.receiveShadow=true;instanced.computeBoundingSphere();group.add(instanced);
  });
  let triangles=0,instances=0,drawCalls=0;
  group.traverse(object=>{if(object instanceof THREE.Mesh){const count=object instanceof THREE.InstancedMesh?object.count:1;instances+=count;drawCalls++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*count;}});
  const metrics={triangles,instances,drawCalls};group.userData.metrics=metrics;
  function updateTheme(dark:boolean){
    waterMaterial.uniforms.uDark.value=dark?1:0;waterMaterial.uniforms.uColor.value.set(dark?"#16343d":"#729497");waterMaterial.uniforms.uMist.value.set(dark?"#263d46":"#b5bfb4");
    glass.emissiveIntensity=dark?.34:.06;window.emissiveIntensity=dark?.7:.12;
  }
  function animate(elapsed:number){waterMaterial.uniforms.uTime.value=elapsed;boat.position.y=.18+Math.sin(elapsed*.7)*.028;boat.rotation.z=Math.sin(elapsed*.55)*.009;}
  function dispose(){group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  return {group,metrics,waterMaterial,updateTheme,animate,dispose};
}

export const harborPlaces = [
  { id:"about" as const, label:"关于 DDS", name:"THE OBSERVATORY", number:"01", anchor:new THREE.Vector3(-5.6,6.1,-2.4), point:new THREE.Vector3(-5.6,2,-2.4) },
  { id:"work" as const, label:"创作街区", name:"THE ATELIER", number:"02", anchor:new THREE.Vector3(1.25,4.7,-2.55), point:new THREE.Vector3(2.5,1.4,-.5) },
  { id:"journey" as const, label:"一路走来", name:"THE PROMENADE", number:"03", anchor:new THREE.Vector3(-3.7,2.3,4.3), point:new THREE.Vector3(-4.4,1,4) },
];
