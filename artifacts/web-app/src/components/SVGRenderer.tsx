import React from 'react';

interface SVGRendererProps {
  svgCode?: string; // ? isliye taaki agar kisi question mein diagram na ho toh error na aaye
}

export const SVGRenderer: React.FC<SVGRendererProps> = ({ svgCode }) => {
  // Agar database se is question mein svgDiagram khali aaya hai, toh kuch mat dikhao
  if (!svgCode) return null;

  return (
    <div className="w-full flex justify-center my-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div 
        className="w-full max-w-[250px] md:max-w-[300px] flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svgCode }} 
      />
    </div>
  );
};
