// Organic forest geometry and architectural details for the original porch scene.
// Deterministic instancing keeps the scenery consistent and the GPU workload bounded.
export function enhanceEnvironment({THREE,scene,house,materials:M,renderer,mobile}) {
  let seed=43027;
  const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const time={value:0};
  const matrix=new THREE.Matrix4(), quat=new THREE.Quaternion(), pos=new THREE.Vector3(), scale=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3();
  const foliageData=[],branchData=[],trunkData=[];
  const heightAt=(x,z)=>{const edge=Math.min(1,Math.max(0,(Math.abs(x)-3.8)/9));return edge*(Math.sin(x*.13+z*.04)*.9+Math.cos(z*.17)*.4+.8);};
  const textureLoader=new THREE.TextureLoader();
  const materialTexture=(url,rx,ry)=>{const t=textureLoader.load(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;};
  M.ground.color.set(0x9c9066);
  M.ground.map=materialTexture('assets/forest-floor.jpg',30,30);
  M.ground.normalMap=materialTexture('assets/forest-normal.jpg',30,30);
  M.ground.normalMap.colorSpace=THREE.NoColorSpace;
  M.ground.normalScale.set(.55,.55);
  M.wall.map=materialTexture('assets/timber.jpg',2,1);
  M.wall.color.set(0xcdbb95);
  M.wall.roughness=.94;
  M.wood.map=materialTexture('assets/timber.jpg',2,1);
  M.wood.color.set(0xa88a5c);
  M.trunk.color.set(0x6b5440);
  // A gently undulating forest floor, with a flat clear corridor for the stone path.
  for(const child of [...scene.children])if(child.geometry?.type==='CircleGeometry'&&child.geometry.parameters.radius===140)scene.remove(child);
  const groundGeo=new THREE.PlaneGeometry(190,190,95,95);groundGeo.rotateX(-Math.PI/2);
  const gp=groundGeo.attributes.position;
  for(let i=0;i<gp.count;i++)gp.setY(i,heightAt(gp.getX(i),gp.getZ(i))-.025);
  groundGeo.computeVertexNormals();
  const ground=new THREE.Mesh(groundGeo,M.ground);ground.receiveShadow=true;scene.add(ground);
  // Each fir spray is made from thin, tapered needles with a three-dimensional spine.
  // Unlike cone silhouettes, individual branches break up the skyline and admit light.
  function sprayGeometry(){
    const vertices=[];
    const tri=(a,b,c)=>vertices.push(...a,...b,...c);
    for(let i=0;i<11;i++){
      const y=i/12, w=.31*Math.pow(1-y,.58)+.02;
      for(const side of [-1,1]){
        const z=(i%2?1:-1)*.027;
        tri([0,y,0],[side*w,y+.16,z],[side*w*.14,y+.045,.012]);
        tri([side*w*.14,y+.045,.012],[side*w,y+.16,z],[0,y+.025,-.012]);
      }
    }
    tri([-.013,.82,0],[0,1.05,0],[.013,.82,0]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
  }
  const leaves=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.91,side:THREE.DoubleSide});
  leaves.onBeforeCompile=shader=>{
    shader.uniforms.forestTime=time;
    shader.vertexShader='uniform float forestTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 center = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
      float gust = sin(forestTime * 0.72 + center.x * 0.22 + center.z * 0.19);
      transformed.x += gust * position.y * position.y * 0.075;
      transformed.z += sin(forestTime * 0.49 + center.y) * position.y * 0.038;
    `);
  };
  const trees=[];
  // Foreground trees frame the approach; a deeper forest sits beyond the house.
  for(const item of [[-8,32,14],[8,25,13],[-8,13,12],[9,8,16],[-9,-4,14],[8,-10,15],[-13,46,17],[12,42,17],[-16,8,19]])trees.push(item);
  const count=mobile?36:58;
  while(trees.length<count){
    const x=(random()-.5)*96,z=random()*90-32;
    if(Math.abs(x)<6.8&&z>-7)continue;
    if(Math.abs(x)<5&&z<-7&&z>-18)continue;
    if(trees.some(t=>Math.hypot(t[0]-x,t[1]-z)<4.2))continue;
    trees.push([x,z,9+random()*10]);
  }
  const color=new THREE.Color();
  for(const [x,z,h]of trees){
    const root=heightAt(x,z),width=h*(.15+random()*.035),tilt=(random()-.5)*.18;
    trunkData.push({p:[x,root+h*.46,z],s:[h*.017,h*.94,h*.017],q:[tilt,0,tilt*.5]});
    const tiers=mobile?12:16;
    for(let level=0;level<tiers;level++){
      const t=level/(tiers-1),y=root+h*(.14+.82*t)+(random()-.5)*.25,r=width*Math.pow(1-t,.82)+.13;
      const branches=6+(level%3), phase=random()*6.28;
      for(let b=0;b<branches;b++){
        const angle=phase+b/branches*Math.PI*2;
        const length=r*(.8+random()*.4),dx=Math.cos(angle),dz=Math.sin(angle);
        const rise=length*(-.12+random()*.2);
        const end=new THREE.Vector3(x+dx*length,y+rise,z+dz*length);
        direction.set(dx*length,rise,dz*length);
        const branchLength=direction.length();
        quat.setFromUnitVectors(up,direction.normalize());
        branchData.push({p:[x+dx*length/2,y+rise/2,z+dz*length/2],s:[.022*(1-t)+.006,branchLength,.022*(1-t)+.006],quat:quat.clone()});
        const sprays=mobile?4:6;
        for(let f=0;f<sprays;f++){
          const u=.24+f/sprays*.7;
          for(const side of [-1,1]){
            const turn=angle+side*(.6+random()*.25);
            const slen=length*(.58+.18*random())*(1-u*.25)+.15;
            const sy=.08+random()*.12;
            direction.set(Math.cos(turn),sy,Math.sin(turn)).normalize();
            quat.setFromUnitVectors(up,direction);
            const roll=new THREE.Quaternion().setFromAxisAngle(up,(random()-.5)*1.2);
            quat.multiply(roll);
            const c=color.setHSL(.22+random()*.09,.22+random()*.18,.15+random()*.10+(t*.035)).clone();
            foliageData.push({p:[x+dx*length*u,y+rise*u+(random()-.5)*.16,z+dz*length*u],s:[slen*1.12,slen,slen],quat:quat.clone(),c});
          }
        }
        // A fine terminal shoot finishes each branch instead of a solid triangular tip.
        quat.setFromUnitVectors(up,direction.set(dx,.4,dz).normalize());
        foliageData.push({p:end.toArray(),s:[.36,.65,.36],quat:quat.clone(),c:color.setHex(0x556b3f).clone()});
      }
    }
  }
  function instances(geometry,material,data,shadows){
    const mesh=new THREE.InstancedMesh(geometry,material,data.length);
    const euler=new THREE.Euler();
    data.forEach((d,i)=>{
      pos.set(...d.p);scale.set(...d.s);
      if(d.quat)quat.copy(d.quat);else quat.setFromEuler(euler.set(...(d.q||[0,0,0])));
      matrix.compose(pos,quat,scale);mesh.setMatrixAt(i,matrix);if(d.c)mesh.setColorAt(i,d.c);
    });
    mesh.castShadow=shadows&&!mobile;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
  }
  instances(new THREE.CylinderGeometry(.45,1,1,7,1),M.trunk,trunkData,true);
  instances(new THREE.CylinderGeometry(.32,1,1,5,1),M.trunk,branchData,false);
  instances(sprayGeometry(),leaves,foliageData,false);
  // Ferns and tufts give the approach a soft, uneven edge at human scale.
  const grass=[];
  const n=mobile?1800:4200;
  for(let i=0;i<n;i++){
    const x=(random()-.5)*45,z=random()*69-11;
    const pathX=Math.sin(z*.24)*1.15+Math.sin(z*.07)*.7;
    if(z>3&&Math.abs(x-pathX)<1.15)continue;
    if(Math.abs(x)<3.6&&z<4&&z>-5)continue;
    const s=.12+random()*.32;
    const c=color.setHSL(.15+random()*.09,.25+random()*.2,.22+random()*.18).clone();
    grass.push({p:[x,heightAt(x,z),z],s:[s*.75,s*1.5,s],q:[(random()-.5)*.35,random()*6.28,(random()-.5)*.5],c});
  }
  const grassMat=leaves.clone();grassMat.color.set(0xffffff);
  instances(sprayGeometry(),grassMat,grass,false);
  // Small irregular rocks sit beside the path, softened by moss.
  const rocks=[];
  for(let i=0;i<130;i++){
    const z=5+random()*55,side=random()>.5?1:-1;
    const x=Math.sin(z*.24)*1.15+Math.sin(z*.07)*.7+side*(1.25+random()*2.8);
    const s=.06+random()*.23;
    rocks.push({p:[x,heightAt(x,z)+s*.23,z],s:[s*1.7,s*.65,s],q:[random(),random()*6,random()],c:color.setHSL(.18+random()*.05,.08,.24+random()*.12).convertSRGBToLinear().clone()});
  }
  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  instances(rockGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),rocks,true);
  // Siding, porch balusters, plank seams and window mullions add scale as the camera approaches.
  const trim=new THREE.MeshStandardMaterial({color:0xdccfae,roughness:.82});
  const darkTrim=new THREE.MeshStandardMaterial({color:0x2f3a2c,roughness:.88});
  const addBox=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=!mobile;m.receiveShadow=true;house.add(m);return m;};
  for(let i=0;i<17;i++){
    const y=.14+i*.195;
    // Separate side walls let the entry and windows remain unobstructed.
    addBox(.035,.028,4.9,-3.12,y,-1,M.woodDark);
    addBox(.035,.028,4.9,3.12,y,-1,M.woodDark);
    if(y<1.22||y>2.48)addBox(6.16,.027,.026,0,y,1.52,darkTrim);
    else {for(const [x,w]of [[-2.85,.55],[-.99,.55],[.99,.55],[2.85,.55]])addBox(w,.027,.026,x,y,1.52,darkTrim);}
  }
  for(const x of [-3.1,3.1])addBox(.14,3.4,.14,x,1.72,1.54,trim);
  for(const x of [-1.9,1.9]){
    addBox(1.2,.09,.1,x,2.51,1.59,trim);addBox(1.2,.09,.15,x,1.19,1.62,trim);
    for(const side of [-1,1])addBox(.09,1.32,.10,x+side*.56,1.85,1.61,trim);
    addBox(.035,1.06,.07,x,1.85,1.63,darkTrim);addBox(.89,.035,.07,x,1.85,1.63,darkTrim);
  }
  for(const side of [-1,1]){
    for(let i=0;i<8;i++)addBox(.045,.65,.045,side*(1.24+i*.22),.82,3.6,trim);
    addBox(1.75,.10,.13,side*2.03,1.17,3.6,trim);
  }
  for(let i=0;i<21;i++)addBox(.013,.013,2.28,-3+i*.3,.516,2.6,M.woodDark);
  addBox(1.38,.12,.16,0,2.53,1.62,trim);
  for(const x of [-.65,.65])addBox(.1,2.44,.16,x,1.27,1.62,trim);
  // Roof seams add a believable standing-seam metal finish.
  for(let i=0;i<17;i++){
    const z=-3.86+i*.36;
    for(const side of [-1,1]){
      const seam=addBox(4.15,.035,.035,side*1.8,4.43,z,M.roof);
      seam.rotation.z=-side*Math.atan2(2.1,3.6);
    }
  }
  for(const child of house.children){child.castShadow=!mobile;child.receiveShadow=true;}
  // A little fill light keeps the porch visible against the backlit forest.
  const fill=new THREE.DirectionalLight(0xffc48a,.4);fill.position.set(12,10,30);scene.add(fill);
  // Fine ground mist sits between the trees, with slow drift instead of a flat backdrop.
  const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;
  const ctx=fogCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(222,190,140,.24)');gradient.addColorStop(.5,'rgba(222,190,140,.10)');gradient.addColorStop(1,'rgba(222,190,140,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const mistMap=new THREE.CanvasTexture(fogCanvas),mist=[];
  for(let i=0;i<(mobile?6:12);i++){
    const m=new THREE.Sprite(new THREE.SpriteMaterial({map:mistMap,transparent:true,opacity:.17,depthWrite:false,color:0xd9b98a}));
    const x=(random()-.5)*48,z=-8+random()*55;
    m.position.set(x,.6+heightAt(x,z),z);m.scale.set(15+random()*12,1.5+random()*2,1);scene.add(m);mist.push({m,x,z});
  }
  return {update(t){time.value=t;mist.forEach(({m,x,z},i)=>{m.position.x=x+Math.sin(t*.05+i)*1.2;m.position.z=z+Math.cos(t*.035+i)*.5;});}};
}
