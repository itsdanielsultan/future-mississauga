#include <algorithm>
#include <cmath>
#include <cstdint>

struct Pt {double x,y,z;};
struct Pixel {double x,y,d;};
extern "C" void shade_mask(float* depth,uint8_t* mask,int w,int h,
 const double* positions,const uint32_t* faces,const uint8_t* selected,int count,
 double focal,double cx,double cy,double nearPlane,int orthographic) {
 for(int f=0;f<count;f++) {
  Pt tri[3],clip[5]; int n=0;
  for(int i=0;i<3;i++){const double*p=positions+3*faces[f*3+i];tri[i]={p[0],p[1],-p[2]};}
  for(int i=0;i<3;i++){
   Pt a=tri[i],b=tri[(i+1)%3];bool ai=a.z>=nearPlane,bi=b.z>=nearPlane;
   if(ai)clip[n++]=a;
   if(ai!=bi){double t=(nearPlane-a.z)/(b.z-a.z);clip[n++]={a.x+t*(b.x-a.x),a.y+t*(b.y-a.y),nearPlane};}
  }
  if(n<3)continue;
  Pixel px[5];
  for(int i=0;i<n;i++){Pt p=clip[i];double k=orthographic?focal:focal/p.z;px[i]={cx+p.x*k,cy-p.y*k,orthographic?p.z:1.-nearPlane/p.z};}
  for(int j=1;j<n-1;j++){
   Pixel a=px[0],b=px[j],c=px[j+1];
   double area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   if(std::abs(area)<1e-8)continue;
   int x0=std::max(0,(int)std::min(1e8,std::ceil(std::min({a.x,b.x,c.x})-.5)));
   int x1=std::min(w-1,(int)std::max(-1e8,std::floor(std::max({a.x,b.x,c.x})-.5)));
   int y0=std::max(0,(int)std::min(1e8,std::ceil(std::min({a.y,b.y,c.y})-.5)));
   int y1=std::min(h-1,(int)std::max(-1e8,std::floor(std::max({a.y,b.y,c.y})-.5)));
   for(int y=y0;y<=y1;y++)for(int x=x0;x<=x1;x++){
    double dx=x+.5-a.x,dy=y+.5-a.y;
    double u=(dx*(c.y-a.y)-dy*(c.x-a.x))/area,v=((b.x-a.x)*dy-(b.y-a.y)*dx)/area;
    if(u<0||v<0||u+v>1)continue;
    double d=a.d+u*(b.d-a.d)+v*(c.d-a.d);int i=y*w+x;
    if(d<depth[i]){depth[i]=d;mask[i]=selected[f];}
   }
  }
 }
}
