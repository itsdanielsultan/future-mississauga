#include <algorithm>
#include <cmath>
#include <cstdint>
// Rasterize one indexed mesh into a shared orthographic colour and depth target.
extern "C" void draw(int w,int h,float* zbuf,uint8_t* rgb,const float* verts,const float* shades,const float* colors,const float* uv,const uint8_t* texture,int tw,int th,const int32_t* indices,int count){
 for(int face=0;face<count;face++){
  const int a=indices[face*3],b=indices[face*3+1],c=indices[face*3+2];const float *p=verts+3*a,*q=verts+3*b,*r=verts+3*c;
  float area=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);
  if(std::abs(area)<1.e-7f)continue;
  int x0=std::max(0,(int)std::floor(std::min({p[0],q[0],r[0]}))),x1=std::min(w-1,(int)std::ceil(std::max({p[0],q[0],r[0]})));
  int y0=std::max(0,(int)std::floor(std::min({p[1],q[1],r[1]}))),y1=std::min(h-1,(int)std::ceil(std::max({p[1],q[1],r[1]})));
  for(int y=y0;y<=y1;y++)for(int x=x0;x<=x1;x++){
   float dx=x+.5f-r[0],dy=y+.5f-r[1],u=((q[1]-r[1])*dx+(r[0]-q[0])*dy)/area,v=((r[1]-p[1])*dx+(p[0]-r[0])*dy)/area,t=1-u-v;
   if(u<0||v<0||t<0)continue;
   int k=y*w+x;float depth=u*p[2]+v*q[2]+t*r[2];if(depth<=zbuf[k])continue;
   float light=u*shades[a]+v*shades[b]+t*shades[c];int tex=0;
   if(tw&&th){float tx=u*uv[a*2]+v*uv[b*2]+t*uv[c*2],ty=u*uv[a*2+1]+v*uv[b*2+1]+t*uv[c*2+1];tx-=std::floor(tx);ty-=std::floor(ty);tex=(std::min(th-1,(int)((1-ty)*th))*tw+std::min(tw-1,(int)(tx*tw)))*4;if(texture[tex+3]<80)continue;}
   zbuf[k]=depth;
   for(int j=0;j<3;j++){float co=u*colors[3*a+j]+v*colors[3*b+j]+t*colors[3*c+j];if(tw&&th)co*=texture[tex+j]/255.f;rgb[3*k+j]=(uint8_t)std::clamp(co*light,0.f,255.f);}
  }
 }
}
