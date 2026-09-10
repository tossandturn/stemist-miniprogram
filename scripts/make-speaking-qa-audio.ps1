param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$voice=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SelectVoice('Microsoft Zira Desktop')
  $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
  $samples=@('I would like to work with animals because I enjoy taking care of them. For example, I often help my neighbour look after her dog.','Future.','Rear.')
  for($i=0;$i -lt $samples.Count;$i++) {
    $path=Join-Path $OutputDirectory ('answer-'+$i+'.wav')
    if(Test-Path -LiteralPath $path){throw 'QA audio already exists; choose a new output directory.'}
    $voice.SetOutputToWaveFile($path,$format)
    $voice.Speak($samples[$i])
    $voice.SetOutputToNull()
  }
} finally {$voice.Dispose()}
