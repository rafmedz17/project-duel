export const tracerVertex=`
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv=uv;
  vTint=vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint=instanceColor;
  #endif
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`
export const tracerFragment=`
uniform float halo;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float taper=mix(0.06,0.92,pow(vUv.y,0.65));
  float across=abs(vUv.x-0.5)*2.0/taper;
  float edge=pow(max(0.0,1.0-across),mix(1.3,2.8,halo));
  float tail=smoothstep(0.0,0.24,vUv.y);
  float alpha=edge*tail*mix(0.5,1.0,vUv.y)*mix(0.95,0.23,halo);
  if(alpha<0.004) discard;
  float energy=max(vTint.r,max(vTint.g,vTint.b));
  vec3 color=mix(vTint,vec3(energy),pow(vUv.y,5.0)*mix(0.85,0.15,halo));
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}`
export const tracerGlowFragment=`
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vec2 p=vUv-0.5;
  float radius=length(p)*2.0;
  if(radius>1.0) discard;
  float core=exp(-radius*radius*75.0);
  float corona=exp(-radius*radius*8.0)*0.28;
  float star=pow(1.0-smoothstep(0.0,0.065,min(abs(p.x),abs(p.y))),2.0)*pow(1.0-radius,3.0)*0.4;
  float energy=max(vTint.r,max(vTint.g,vTint.b));
  gl_FragColor=vec4(mix(vTint,vec3(energy),core*0.85),min(1.0,core+corona+star));
  #include <colorspace_fragment>
}`
// Visual profiles never change ballistics, damage or shot timing.
export function tracerProfile(weapon) {
  if(weapon.pellets) return {length:1.4,width:0.018,speed:850,glow:0.09,sparks:2}
  if(weapon.scope) return {length:weapon.penetration ? 7 : 5,width:0.032,speed:1500,glow:0.2,sparks:6}
  if(weapon.category==='SMG') return {length:2.3,width:0.021,speed:1100,glow:0.1,sparks:3}
  if(weapon.category==='LMG') return {length:3.5,width:0.027,speed:1150,glow:0.14,sparks:4}
  if(weapon.category==='PISTOL') return {length:2,width:0.023,speed:1000,glow:0.12,sparks:3}
  return {length:3.2,width:0.025,speed:1200,glow:0.13,sparks:4}
}
