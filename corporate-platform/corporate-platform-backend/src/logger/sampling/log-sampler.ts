export class LogSampler {
  private static SAMPLE_RATE = process.env.LOG_SAMPLE_RATE
    ? parseFloat(process.env.LOG_SAMPLE_RATE)
    : 0.1; // 10% default

  private static readonly DEBUG_SAMPLE_RATE = process.env.LOG_DEBUG_SAMPLE_RATE
    ? parseFloat(process.env.LOG_DEBUG_SAMPLE_RATE)
    : 0.05; // 5% default for debug

  /**
   * Determines if a log entry should be sampled
   */
  static shouldSample(level: string): boolean {
    // Always log errors and fatal
    if (level === 'error' || level === 'fatal') {
      return true;
    }

    // Sample debug at lower rate
    if (level === 'debug') {
      return Math.random() < this.DEBUG_SAMPLE_RATE;
    }

    // Sample other levels at configured rate
    return Math.random() < this.SAMPLE_RATE;
  }

  /**
   * Sets the sample rate (useful for testing)
   */
  static setSampleRate(rate: number): void {
    this.SAMPLE_RATE = rate;
  }
}
