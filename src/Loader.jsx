import React, { useState, useEffect } from 'react'

const steps = [
  { id: 1, label: 'AI is reviewing the menu' },
  { id: 2, label: 'AI is collecting the spices' },
  { id: 3, label: 'AI is cooking your SOP' },
  { id: 4, label: 'SOP will now be served' },
]

const Loader = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (currentStep >= steps.length) {
      setTimeout(() => onComplete(), 800)
      return
    }
    const timer = setTimeout(() => {
      setCurrentStep(prev => prev + 1)
    }, 1500)
    return () => clearTimeout(timer)
  }, [currentStep])

  return (
    <div className="flex flex-col items-center justify-center bg-[#d9efff] min-h-screen m-2 rounded-3xl">
      <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-md text-center">

        {/* Spinner */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-[#d9efff] border-t-[#00528d] animate-spin"/>
        </div>

        <h2 className="text-xl font-semibold text-[#00528d] mb-2">Analysing your transcript</h2>
        <p className="text-xs text-[#5a8aaa] mb-8">Please wait while we prepare your SOP</p>

        {/* Steps */}
        <div className="flex flex-col gap-3 text-left">
          {steps.map((step, index) => {
            const isDone = index < currentStep
            const isActive = index === currentStep
            const isPending = index > currentStep

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500
                  ${isDone ? 'bg-[#f0faff]' : ''}
                  ${isActive ? 'bg-[#d9efff]' : ''}
                  ${isPending ? 'opacity-35' : ''}
                `}
              >
                {/* Step icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500
                  ${isDone ? 'bg-[#00528d]' : ''}
                  ${isActive ? 'bg-[#69c0ff] animate-pulse' : ''}
                  ${isPending ? 'bg-[#b8dcf8]' : ''}
                `}>
                  {isDone ? (
                    <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                      <path d="M2 7l3 3 7-6"/>
                    </svg>
                  ) : (
                    <span className="text-white text-xs font-semibold">{step.id}</span>
                  )}
                </div>

                {/* Label */}
                <span className={`text-sm transition-all duration-300
                  ${isDone ? 'text-[#00528d] font-medium' : ''}
                  ${isActive ? 'text-[#00528d] font-semibold' : ''}
                  ${isPending ? 'text-[#5a8aaa]' : ''}
                `}>
                  {step.label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00528d] animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00528d] animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00528d] animate-bounce" style={{ animationDelay: '300ms' }}/>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

export default Loader