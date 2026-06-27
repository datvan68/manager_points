# Changelog Draft

## [Unreleased]

### Added
- **Mobile List Optimization**: Implemented backend-batched infinite scrolling for mobile lists. This feature significantly improves performance and reduces initial data load times by dynamically fetching data in batches as the user scrolls.

---

# README Section Draft

## Infinite Scroll on Mobile
Our mobile lists support backend-batched infinite scrolling. This ensures optimal memory usage and network performance by only loading data segments as they are needed by the user.

- **How it works**: As the user approaches the end of the current list, a new batch of items is requested from the backend automatically, providing a seamless scrolling experience.
- **Benefits**: Faster initial load times, reduced memory footprint on mobile devices, and smoother overall user experience.
