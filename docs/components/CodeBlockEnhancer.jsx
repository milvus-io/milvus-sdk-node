'use client';

import { useEffect } from 'react';

function addCopyButton(block) {
  // Check if button already exists
  if (block.querySelector('[data-copy-button]')) {
    return;
  }

  const codeElement = block.querySelector('code');
  if (!codeElement) return;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.setAttribute('data-copy-button', 'true');
  buttonContainer.style.position = 'absolute';
  buttonContainer.style.top = '5px';
  buttonContainer.style.right = '5px';
  buttonContainer.style.zIndex = '10';

  // Create button
  const button = document.createElement('button');
  button.setAttribute('aria-label', 'Copy code');
  button.style.opacity = '0';
  button.style.transition = 'opacity 0.2s';
  button.style.width = '36px';
  button.style.height = '36px';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.borderRadius = '6px';
  button.style.cursor = 'pointer';
  
  // Set button styles based on dark mode
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    button.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    button.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    button.style.color = 'rgba(255, 255, 255, 0.9)';
  } else {
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    button.style.border = '1px solid rgba(0, 0, 0, 0.1)';
    button.style.color = 'rgba(0, 0, 0, 0.9)';
  }
  button.style.backdropFilter = 'blur(8px)';

  // Copy icon SVG
  const copyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  copyIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copyIcon.setAttribute('width', '14');
  copyIcon.setAttribute('height', '14');
  copyIcon.setAttribute('viewBox', '0 0 24 24');
  copyIcon.setAttribute('fill', 'none');
  copyIcon.setAttribute('stroke', 'currentColor');
  copyIcon.setAttribute('stroke-width', '2');
  copyIcon.setAttribute('stroke-linecap', 'round');
  copyIcon.setAttribute('stroke-linejoin', 'round');
  copyIcon.style.color = 'inherit';

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '14');
  rect.setAttribute('height', '14');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');

  copyIcon.appendChild(rect);
  copyIcon.appendChild(path);
  button.appendChild(copyIcon);

  // Copy functionality
  let isCopied = false;
  button.addEventListener('click', async () => {
    if (isCopied) return;

    const codeText = codeElement.textContent || codeElement.innerText || '';
    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(codeText);
      isCopied = true;

      // Change icon to checkmark
      const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      checkIcon.setAttribute('width', '14');
      checkIcon.setAttribute('height', '14');
      checkIcon.setAttribute('viewBox', '0 0 24 24');
      checkIcon.setAttribute('fill', 'none');
      checkIcon.setAttribute('stroke', 'currentColor');
      checkIcon.setAttribute('stroke-width', '2');
      checkIcon.setAttribute('stroke-linecap', 'round');
      checkIcon.setAttribute('stroke-linejoin', 'round');

      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '20 6 9 17 4 12');
      checkIcon.appendChild(polyline);

      button.innerHTML = '';
      button.appendChild(checkIcon);

      setTimeout(() => {
        isCopied = false;
        button.innerHTML = '';
        button.appendChild(copyIcon.cloneNode(true));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  });

      // Show button on hover
      block.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
      });
      block.addEventListener('mouseleave', () => {
        if (!isCopied) {
          button.style.opacity = '0';
        }
      });
      
      // Update button hover style
      button.addEventListener('mouseenter', () => {
        const isCurrentlyDark = document.documentElement.classList.contains('dark');
        if (isCurrentlyDark) {
          button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        } else {
          button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }
      });
      button.addEventListener('mouseleave', () => {
        const isCurrentlyDark = document.documentElement.classList.contains('dark');
        if (isCurrentlyDark) {
          button.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
        } else {
          button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        }
      });

  buttonContainer.appendChild(button);
  block.style.position = 'relative';
  block.appendChild(buttonContainer);
}

export default function CodeBlockEnhancer() {
  useEffect(() => {
    // Function to add copy buttons to all code blocks
    const enhanceCodeBlocks = () => {
      const codeBlocks = document.querySelectorAll('.nextra-code');
      codeBlocks.forEach(addCopyButton);
    };

    // Run immediately
    enhanceCodeBlocks();

    // Also run after a short delay to catch dynamically loaded content
    const timeoutId = setTimeout(enhanceCodeBlocks, 100);

    // Use MutationObserver to watch for new code blocks
    const observer = new MutationObserver(() => {
      enhanceCodeBlocks();
    });

    // Observe the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  return null;
}

